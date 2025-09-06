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
    if (!this.barkUrl) {
      console.log('Bark URL not configured, skipping notification');
      return;
    }

    let message = 'OpenRouter Free Models Update:\\n\\n';
    
    if (addedModels.length > 0) {
      message += `✅ Added (${addedModels.length}):\\n`;
      addedModels.forEach(model => {
        message += `• ${model.name || model.id}\\n`;
      });
      message += '\\n';
    }

    if (removedModels.length > 0) {
      message += `❌ Removed (${removedModels.length}):\\n`;
      removedModels.forEach(model => {
        message += `• ${model.name || model.id}\\n`;
      });
    }

    await this.sendBarkNotification('Free Models Changed', message, 'update');
  }

  /**
   * Send notification via Bark
   */
  async sendBarkNotification(title, body, category = 'default') {
    if (!this.barkUrl) return;

    try {
      const url = `${this.barkUrl}${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=openrouter&category=${category}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'OpenRouter-Monitor/1.0'
        }
      });

      if (!response.ok) {
        console.error('Bark notification failed:', response.status, response.statusText);
      } else {
        console.log('Bark notification sent successfully');
      }
    } catch (error) {
      console.error('Error sending Bark notification:', error);
    }
  }
}
