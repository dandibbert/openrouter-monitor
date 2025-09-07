/**
 * ModelMonitor - Handles OpenRouter API monitoring and change detection
 */
export class ModelMonitor {
  constructor(env) {
    this.env = env;
    this.kv = env.OPENROUTER_KV;
    this.barkUrl = env.BARK_API_URL;
    this.openrouterApiKey = env.OPENROUTER_API_KEY;
    this.openrouterApiUrl = 'https://openrouter.ai/api/v1/models';
  }

  /**
   * Main monitoring function - fetches models, detects changes, sends notifications
   */
  async runMonitoring() {
    try {
      console.log('Starting OpenRouter models monitoring...');

      // Fetch current models from OpenRouter API
      const currentModels = await this.fetchOpenRouterModels();
      
      if (!currentModels || currentModels.length === 0) {
        throw new Error('No models received from OpenRouter API');
      }

      // Get previously stored models
      const previousData = await this.getPreviousModelsData();
      
      // Identify free models in current data
      const currentFreeModels = this.identifyFreeModels(currentModels);
      
      // Store current data
      await this.storeModelsData({
        timestamp: new Date().toISOString(),
        totalModels: currentModels.length,
        freeModels: currentFreeModels,
        allModels: currentModels
      });

      // Compare with previous data and send notifications if changes detected
      if (previousData && previousData.freeModels) {
        await this.detectAndNotifyChanges(previousData.freeModels, currentFreeModels);
      }

      console.log(`Monitoring complete. Found ${currentFreeModels.length} free models out of ${currentModels.length} total models.`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Monitoring completed successfully',
        totalModels: currentModels.length,
        freeModels: currentFreeModels.length,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Monitoring error:', error);
      
      // Send error notification via Bark if configured
      if (this.barkUrl) {
        await this.sendBarkNotification(
          'OpenRouter Monitor Error',
          `Monitoring failed: ${error.message}`,
          'error'
        );
      }

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Fetch models from OpenRouter API
   */
  async fetchOpenRouterModels() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenRouter-Monitor/1.0'
    };

    // Add API key if provided for higher rate limits
    if (this.openrouterApiKey) {
      headers['Authorization'] = `Bearer ${this.openrouterApiKey}`;
    }

    const response = await fetch(this.openrouterApiUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Identify free models from the models list
   * Free models are:
   * 1. Models with :free suffix
   * 2. Models with pricing.prompt = "0" or pricing.completion = "0"
   */
  identifyFreeModels(models) {
    return models.filter(model => {
      // Check if model ID ends with :free
      if (model.id && model.id.endsWith(':free')) {
        return true;
      }

      // Check if pricing indicates free (0 cost)
      if (model.pricing) {
        const promptPrice = parseFloat(model.pricing.prompt || '0');
        const completionPrice = parseFloat(model.pricing.completion || '0');
        
        // Model is free if both prompt and completion are 0
        if (promptPrice === 0 && completionPrice === 0) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Get previously stored models data
   */
  async getPreviousModelsData() {
    try {
      const data = await this.kv.get('models_data');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving previous models data:', error);
      return null;
    }
  }

  /**
   * Store current models data
   */
  async storeModelsData(data) {
    try {
      await this.kv.put('models_data', JSON.stringify(data));
      await this.kv.put('last_update', data.timestamp);
    } catch (error) {
      console.error('Error storing models data:', error);
      throw error;
    }
  }

  /**
   * Detect changes in free models and send notifications
   */
  async detectAndNotifyChanges(previousFreeModels, currentFreeModels) {
    const previousIds = new Set(previousFreeModels.map(m => m.id));
    const currentIds = new Set(currentFreeModels.map(m => m.id));

    // Find added models
    const addedModels = currentFreeModels.filter(model => !previousIds.has(model.id));
    
    // Find removed models
    const removedModels = previousFreeModels.filter(model => !currentIds.has(model.id));

    // Send notifications if there are changes
    if (addedModels.length > 0 || removedModels.length > 0) {
      await this.sendChangeNotification(addedModels, removedModels);
    }
  }

  /**
   * Send notification about free model changes via Bark
   */
  async sendChangeNotification(addedModels, removedModels) {
    // 先尝试使用环境变量中的 Bark URL，如果没有则从 KV 设置中获取
    let barkUrl = this.barkUrl;
    if (!barkUrl) {
      barkUrl = await this.getBarkUrlFromSettings();
    }
    
    if (!barkUrl) {
      console.log('Bark URL not configured, skipping notification');
      return;
    }

    let content = '';
    const addedNames = [];
    const removedNames = [];
    
    if (addedModels.length > 0) {
      addedModels.forEach(model => {
        addedNames.push(model.name || model.id);
      });
    }

    if (removedModels.length > 0) {
      removedModels.forEach(model => {
        removedNames.push(model.name || model.id);
      });
    }

    // 构建内容格式：新增免费模型：a,b；失效免费模型：c,d
    const parts = [];
    if (addedNames.length > 0) {
      parts.push(`新增免费模型：${addedNames.join(',')}`);
    }
    if (removedNames.length > 0) {
      parts.push(`失效免费模型：${removedNames.join(',')}`);
    }
    content = parts.join('；');

    // 使用获取的 barkUrl
    const originalBarkUrl = this.barkUrl;
    this.barkUrl = barkUrl;
    
    try {
      await this.sendBarkNotification('OpenRouter免费模型更新', content, 'update');
    } finally {
      this.barkUrl = originalBarkUrl;
    }
  }

  /**
   * 测试 Bark 推送功能
   */
  async testBarkNotification() {
    // 从 KV 设置中获取 Bark URL
    const barkUrl = await this.getBarkUrlFromSettings();
    if (!barkUrl) {
      throw new Error('Bark API URL 未配置，请在设置中配置');
    }

    // 模拟一些测试数据
    const mockAddedModels = [
      { id: 'test-model-1:free', name: 'Test Model 1 Free' },
      { id: 'test-model-2:free', name: 'Test Model 2 Free' }
    ];
    
    const mockRemovedModels = [
      { id: 'old-model-1:free', name: 'Old Model 1 Free' },
      { id: 'old-model-2:free', name: 'Old Model 2 Free' }
    ];

    // 使用从设置中获取的 Bark URL
    const originalBarkUrl = this.barkUrl;
    this.barkUrl = barkUrl;
    
    try {
      // 发送测试通知
      await this.sendChangeNotification(mockAddedModels, mockRemovedModels);
      
      return {
        success: true,
        message: '测试推送已发送',
        barkUrl: barkUrl.replace(/\/[^/]+\/$/, '/****/'), // 隐藏API key
        testData: {
          added: mockAddedModels.map(m => m.name || m.id),
          removed: mockRemovedModels.map(m => m.name || m.id)
        }
      };
    } finally {
      // 恢复原始 Bark URL
      this.barkUrl = originalBarkUrl;
    }
  }

  /**
   * 从 KV 设置中获取 Bark URL
   */
  async getBarkUrlFromSettings() {
    try {
      const settings = await this.kv.get('app_settings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        return parsedSettings.barkBaseUrl || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting Bark URL from settings:', error);
      return null;
    }
  }

  /**
   * Send notification via Bark
   */
  async sendBarkNotification(title, body, category = 'default') {
    if (!this.barkUrl) return;

    try {
      // 确保 Bark URL 以 / 结尾
      const baseUrl = this.barkUrl.endsWith('/') ? this.barkUrl : this.barkUrl + '/';
      const url = `${baseUrl}${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=openrouter&category=${category}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'OpenRouter-Monitor/1.0'
        }
      });

      if (!response.ok) {
        console.error('Bark notification failed:', response.status, response.statusText);
        throw new Error(`Bark 推送失败: ${response.status} ${response.statusText}`);
      } else {
        console.log('Bark notification sent successfully');
      }
    } catch (error) {
      console.error('Error sending Bark notification:', error);
      throw error;
    }
  }
}
