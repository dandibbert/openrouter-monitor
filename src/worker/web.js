/**
 * WebInterface - Handles web UI serving and API endpoints
 */
export class WebInterface {
  constructor(env) {
    this.env = env;
    this.kv = env.OPENROUTER_KV;
  }

  /**
   * Serve web interface files
   */
  async serveWeb(path) {
    // Default to index.html for root path
    if (path === '/') {
      path = '/index.html';
    }

    // Remove leading slash for file lookup
    const fileName = path.substring(1);
    
    // Map of file types to content types
    const contentTypes = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json'
    };

    try {
      // Get file extension
      const ext = fileName.split('.').pop() || 'html';
      const contentType = contentTypes[ext] || 'text/plain';

      // For now, return the main HTML file for any request
      // In production, you'd serve actual static files
      if (fileName === 'index.html' || !fileName.includes('.')) {
        return new Response(await this.getIndexHTML(), {
          headers: { 'Content-Type': 'text/html' }
        });
      } else if (fileName === 'style.css') {
        return new Response(await this.getCSS(), {
          headers: { 'Content-Type': 'text/css' }
        });
      } else if (fileName === 'script.js') {
        return new Response(await this.getJS(), {
          headers: { 'Content-Type': 'application/javascript' }
        });
      }

      return new Response('File not found', { status: 404 });
    } catch (error) {
      console.error('Error serving web file:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * API endpoint to get all models
   */
  async getModelsApi(request) {
    try {
      const data = await this.kv.get('models_data');
      if (!data) {
        return new Response(JSON.stringify({
          error: 'No models data available',
          message: 'Run monitoring first to collect data'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const modelsData = JSON.parse(data);
      return new Response(JSON.stringify({
        success: true,
        data: modelsData.allModels || [],
        timestamp: modelsData.timestamp,
        totalCount: modelsData.totalModels || 0
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error getting models data:', error);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve models data',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate JavaScript for frontend functionality
   */
  async getJS() {
    return `class OpenRouterMonitor {
    constructor() {
        this.allModels = [];
        this.filteredModels = [];
        this.showFreeOnly = false;
        this.currentSort = 'created';
        this.isRefreshing = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
        await this.loadStatus();
    }

    bindEvents() {
        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterAndDisplayModels();
        });

        // Sort select
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.filterAndDisplayModels();
        });

        // Free only button
        document.getElementById('freeOnlyBtn').addEventListener('click', () => {
            this.toggleFreeOnly();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refresh({ showNotification: true, showLoading: true, disableButton: true });
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        // Auto refresh every 5 minutes
        setInterval(() => {
            this.refresh({ showNotification: false, showLoading: false, disableButton: false });
        }, 5 * 60 * 1000);
        
        // 开发模式：根据设置的间隔定时更新数据
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.startDevTimer();
        }
    }

    async loadData() {
        try {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('error').style.display = 'none';
            document.getElementById('modelsContainer').innerHTML = '';

            const response = await fetch('/api/models');
            const result = await response.json();

            if (result.success) {
                this.allModels = result.data || [];
                this.updateStats();
                this.filterAndDisplayModels();
                document.getElementById('loading').style.display = 'none';
            } else {
                throw new Error(result.message || 'Failed to load models');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = 'Error: ' + error.message;
        }
    }

    async loadStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            const statusElement = document.getElementById('status');
            const lastUpdateElement = document.getElementById('lastUpdate');
            
            if (status.status === 'healthy') {
                statusElement.innerHTML = '🟢 在线';
            } else {
                statusElement.innerHTML = '🔴 错误';
            }
            
            if (status.lastUpdate && status.lastUpdate !== 'Never') {
                const date = new Date(status.lastUpdate);
                lastUpdateElement.textContent = '最后更新: ' + date.toLocaleString('zh-CN');
            }
        } catch (error) {
            console.error('Error loading status:', error);
            document.getElementById('status').innerHTML = '🟡 未知';
        }
    }

    updateStats() {
        const freeModels = this.allModels.filter(model => this.isFreeModel(model));
        
        document.getElementById('totalModels').textContent = this.allModels.length;
        document.getElementById('freeModels').textContent = freeModels.length;
    }

    isFreeModel(model) {
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
    }

    filterAndDisplayModels() {
        let filtered = [...this.allModels];
        
        // Apply free only filter
        if (this.showFreeOnly) {
            filtered = filtered.filter(model => this.isFreeModel(model));
        }
        
        // Apply search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(model => {
                return (
                    (model.name && model.name.toLowerCase().includes(searchTerm)) ||
                    (model.id && model.id.toLowerCase().includes(searchTerm)) ||
                    (model.description && model.description.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'created':
                    const aCreated = parseInt(a.created || '0');
                    const bCreated = parseInt(b.created || '0');
                    return bCreated - aCreated; // Descending order (newest first)
                case 'name':
                    return (a.name || a.id || '').localeCompare(b.name || b.id || '');
                case 'id':
                    return (a.id || '').localeCompare(b.id || '');
                case 'pricing':
                    const aPrice = parseFloat(a.pricing?.prompt || '0');
                    const bPrice = parseFloat(b.pricing?.prompt || '0');
                    return aPrice - bPrice;
                case 'context':
                    const aContext = parseInt(a.context_length || '0');
                    const bContext = parseInt(b.context_length || '0');
                    return bContext - aContext; // Descending order
                default:
                    return 0;
            }
        });
        
        this.filteredModels = filtered;
        document.getElementById('displayedModels').textContent = filtered.length;
        this.displayModels(filtered);
    }

    displayModels(models) {
        const container = document.getElementById('modelsContainer');
        
        if (models.length === 0) {
            container.innerHTML = '<div class="no-results">没有找到符合条件的模型。</div>';
            return;
        }
        
        container.innerHTML = models.map(model => this.createModelCard(model)).join('');
        
        // Add click handlers for model IDs
        container.querySelectorAll('.model-id').forEach(element => {
            element.addEventListener('click', () => {
                this.copyToClipboard(element.textContent);
            });
        });
    }

    formatPrice(price) {
        const priceNum = parseFloat(price || '0');
        if (priceNum === 0) return '免费';
        const pricePerMillion = priceNum * 1000000;
        if (pricePerMillion >= 1) {
            return '$' + pricePerMillion.toFixed(2);
        } else {
            return '$' + pricePerMillion.toFixed(4);
        }
    }

    createModelCard(model) {
        const isFree = this.isFreeModel(model);
        const promptPrice = model.pricing ? parseFloat(model.pricing.prompt || '0') : 0;
        const completionPrice = model.pricing ? parseFloat(model.pricing.completion || '0') : 0;
        const requestPrice = model.pricing ? parseFloat(model.pricing.request || '0') : 0;
        const imagePrice = model.pricing ? parseFloat(model.pricing.image || '0') : 0;
        const webSearchPrice = model.pricing ? parseFloat(model.pricing.web_search || '0') : 0;
        const reasoningPrice = model.pricing ? parseFloat(model.pricing.internal_reasoning || '0') : 0;
        const cacheReadPrice = model.pricing ? parseFloat(model.pricing.input_cache_read || '0') : 0;
        const cacheWritePrice = model.pricing ? parseFloat(model.pricing.input_cache_write || '0') : 0;
        const createdDate = model.created ? new Date(model.created * 1000).toLocaleDateString('zh-CN') : '未知';
        
        return \`
        <div class="model-card \${isFree ? 'free' : ''}">
            <div class="model-header">
                <div class="model-info">
                    <div class="model-name">\${model.name || model.id || '未命名模型'}</div>
                    <div class="model-id" title="点击复制">\${model.id || ''}</div>
                </div>
                \${isFree ? '<div class="free-badge">免费</div>' : ''}
            </div>
            
            \${model.description ? \`
            <div class="model-description" onclick="this.classList.toggle('expanded')">
                \${model.description}
            </div>
            <div class="expand-toggle" onclick="document.querySelector('.model-description').classList.toggle('expanded')">
                点击展开/折叠描述
            </div>
            \` : ''}
            
            <!-- 基本信息 -->
            <div class="model-details">
                <div class="detail-item">
                    <span class="detail-label">创建日期</span>
                    <span class="detail-value">\${createdDate}</span>
                </div>
                \${model.context_length ? \`
                <div class="detail-item">
                    <span class="detail-label">上下文长度</span>
                    <span class="detail-value highlight">\${parseInt(model.context_length).toLocaleString()}</span>
                </div>
                \` : ''}
                <div class="detail-item">
                    <span class="detail-label">输入价格 (/M tokens)</span>
                    <span class="detail-value \${promptPrice === 0 ? 'free' : ''}">\${this.formatPrice(model.pricing?.prompt)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">输出价格 (/M tokens)</span>
                    <span class="detail-value \${completionPrice === 0 ? 'free' : ''}">\${this.formatPrice(model.pricing?.completion)}</span>
                </div>
                \${requestPrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">请求价格</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.request)}</span>
                </div>
                \` : ''}
                \${imagePrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">图像价格</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.image)}</span>
                </div>
                \` : ''}
                \${webSearchPrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">网络搜索价格</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.web_search)}</span>
                </div>
                \` : ''}
                \${reasoningPrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">内部推理价格 (/M tokens)</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.internal_reasoning)}</span>
                </div>
                \` : ''}
                \${cacheReadPrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">缓存读取 (/M tokens)</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.input_cache_read)}</span>
                </div>
                \` : ''}
                \${cacheWritePrice > 0 ? \`
                <div class="detail-item">
                    <span class="detail-label">缓存写入 (/M tokens)</span>
                    <span class="detail-value">\${this.formatPrice(model.pricing?.input_cache_write)}</span>
                </div>
                \` : ''}
            </div>
            
            <!-- 架构信息 -->
            \${model.architecture ? \`
            <div class="expandable-section">
                <div class="expandable-header" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('span').textContent = this.nextElementSibling.classList.contains('expanded') ? '▲' : '▼'">
                    架构信息 <span>▼</span>
                </div>
                <div class="expandable-content">
                    <div class="model-details">
                        \${model.architecture.modality ? \`
                        <div class="detail-item">
                            <span class="detail-label">模态</span>
                            <span class="detail-value">\${model.architecture.modality}</span>
                        </div>
                        \` : ''}
                        \${model.architecture.tokenizer ? \`
                        <div class="detail-item">
                            <span class="detail-label">分词器</span>
                            <span class="detail-value">\${model.architecture.tokenizer}</span>
                        </div>
                        \` : ''}
                        \${model.architecture.input_modalities ? \`
                        <div class="detail-item">
                            <span class="detail-label">输入模态</span>
                            <span class="detail-value">\${model.architecture.input_modalities.join(', ')}</span>
                        </div>
                        \` : ''}
                        \${model.architecture.output_modalities ? \`
                        <div class="detail-item">
                            <span class="detail-label">输出模态</span>
                            <span class="detail-value">\${model.architecture.output_modalities.join(', ')}</span>
                        </div>
                        \` : ''}
                    </div>
                </div>
            </div>
            \` : ''}
            
            <!-- 提供商信息 -->
            \${model.top_provider ? \`
            <div class="expandable-section">
                <div class="expandable-header" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('span').textContent = this.nextElementSibling.classList.contains('expanded') ? '▲' : '▼'">
                    提供商信息 <span>▼</span>
                </div>
                <div class="expandable-content">
                    <div class="model-details">
                        <div class="detail-item">
                            <span class="detail-label">主要提供商</span>
                            <span class="detail-value highlight">\${model.top_provider.name || '未知'}</span>
                        </div>
                        \${model.top_provider.context_length ? \`
                        <div class="detail-item">
                            <span class="detail-label">支持上下文</span>
                            <span class="detail-value">\${parseInt(model.top_provider.context_length).toLocaleString()}</span>
                        </div>
                        \` : ''}
                        \${model.top_provider.max_completion_tokens ? \`
                        <div class="detail-item">
                            <span class="detail-label">最大输出</span>
                            <span class="detail-value">\${parseInt(model.top_provider.max_completion_tokens).toLocaleString()}</span>
                        </div>
                        \` : ''}
                        <div class="detail-item">
                            <span class="detail-label">内容审查</span>
                            <span class="detail-value">\${model.top_provider.is_moderated ? '是' : '否'}</span>
                        </div>
                    </div>
                </div>
            </div>
            \` : ''}
            
            <!-- 支持参数 -->
            \${model.supported_parameters && model.supported_parameters.length > 0 ? \`
            <div class="expandable-section">
                <div class="expandable-header" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('span').textContent = this.nextElementSibling.classList.contains('expanded') ? '▲' : '▼'">
                    支持参数 (\${model.supported_parameters.length}) <span>▼</span>
                </div>
                <div class="expandable-content">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                        \${model.supported_parameters.map(param => \`<span style="background: rgba(255, 122, 0, 0.1); color: #ff7a00; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; border: 1px solid rgba(255, 122, 0, 0.2);">\${param}</span>\`).join('')}
                    </div>
                </div>
            </div>
            \` : ''}
        </div>
        \`;
    }

    toggleFreeOnly() {
        this.showFreeOnly = !this.showFreeOnly;
        const btn = document.getElementById('freeOnlyBtn');
        
        if (this.showFreeOnly) {
            btn.classList.add('active');
            btn.textContent = '🔄 显示所有模型';
        } else {
            btn.classList.remove('active');
            btn.textContent = '💰 仅显示免费模型';
        }
        
        this.filterAndDisplayModels();
    }

    async refresh(options = {}) {
        const { showNotification = false, showLoading = false, disableButton = true } = options;

        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;

        const refreshBtn = document.getElementById('refreshBtn');
        const loadingElement = document.getElementById('loading');
        const errorElement = document.getElementById('error');
        const originalText = refreshBtn ? refreshBtn.textContent : '';

        if (disableButton && refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ 刷新中...';
            refreshBtn.classList.add('refreshing');
        }

        if (showLoading && loadingElement) {
            loadingElement.style.display = 'block';
        }

        if (errorElement) {
            errorElement.style.display = 'none';
        }

        let refreshSuccess = false;
        let notificationMessage = '';

        try {
            const response = await fetch('/api/monitor/run', {
                cache: 'no-store'
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || '刷新失败');
            }

            refreshSuccess = true;
            notificationMessage = '刷新完成，数据已更新！';
        } catch (error) {
            console.error('Error refreshing data:', error);
            notificationMessage = '刷新失败: ' + (error.message || '未知错误');
        } finally {
            try {
                await this.loadData();
            } catch (loadError) {
                console.error('Error reloading data:', loadError);
            }

            try {
                await this.loadStatus();
            } catch (statusError) {
                console.error('Error refreshing status:', statusError);
            }

            if (disableButton && refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = originalText || '🔄 刷新';
                refreshBtn.classList.remove('refreshing');
            }

            if ((showNotification || !refreshSuccess) && notificationMessage) {
                this.showNotification(notificationMessage);
            }

            this.isRefreshing = false;
        }
    }
    
    async startDevTimer() {
        // 首次获取设置并启动定时器
        await this.updateDevTimer();
        
        // 每分钟检查一次设置是否变化
        setInterval(async () => {
            await this.updateDevTimer();
        }, 60 * 1000);
    }
    
    async updateDevTimer() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            
            const intervalMinutes = settings.success ? (settings.data.monitorInterval || 5) : 5;
            const intervalMs = intervalMinutes * 60 * 1000;
            
            // 如果间隔发生变化，重新设置定时器
            if (this.currentDevInterval !== intervalMs) {
                if (this.devTimer) {
                    clearInterval(this.devTimer);
                }
                
                this.currentDevInterval = intervalMs;
                console.log('开发模式: 设置监控间隔为 ' + intervalMinutes + ' 分钟');
                
                this.devTimer = setInterval(async () => {
                    await this.checkAndUpdateData();
                }, intervalMs);
                
                // 只在设置变更时立即执行监控，页面加载时不执行
                if (this.isUpdatingSettings) {
                    await this.checkAndUpdateData();
                    this.isUpdatingSettings = false;
                }
            }
        } catch (error) {
            console.log('获取开发模式设置失败: ' + error);
            // 如果获取设置失败，使用默认5分钟
            if (!this.devTimer) {
                this.currentDevInterval = 5 * 60 * 1000;
                this.devTimer = setInterval(async () => {
                    await this.checkAndUpdateData();
                }, this.currentDevInterval);
            }
        }
    }
    
    async checkAndUpdateData() {
        try {
            // 在开发模式下手动触发监控
            const response = await fetch('/api/monitor/run');
            const result = await response.json();
            
            if (result.success) {
                // 仅在数据有更新时刷新界面
                await this.loadData();
                await this.loadStatus();
                console.log('数据已更新: ' + new Date().toLocaleString('zh-CN'));
            }
        } catch (error) {
            console.log('开发模式数据更新失败: ' + error);
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('模型ID已复制到剪贴板！');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('模型ID已复制到剪贴板！');
        });
    }

    showNotification(message) {
        // Remove existing notification
        const existing = document.querySelector('.copy-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    async showSettings() {
        try {
            // 获取当前设置
            const response = await fetch('/api/settings');
            const result = await response.json();
            
            if (result.success) {
                // 填充当前设置到表单
                document.getElementById('monitorInterval').value = result.data.monitorInterval || 5;
                document.getElementById('barkBaseUrl').value = result.data.barkBaseUrl || '';
                document.getElementById('authKey').value = '';
                
                // 显示模态框
                const modal = document.getElementById('settingsModal');
                modal.style.display = 'block';
                
                // 绑定事件
                this.bindSettingsEvents();
            } else {
                this.showNotification('获取设置失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showNotification('获取设置失败');
        }
    }
    
    bindSettingsEvents() {
        const modal = document.getElementById('settingsModal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelSettings');
        const saveBtn = document.getElementById('saveSettings');
        
        // 关闭按钮
        closeBtn.onclick = () => this.hideSettings();
        cancelBtn.onclick = () => this.hideSettings();
        
        // 点击模态框外部关闭
        modal.onclick = (event) => {
            if (event.target === modal) {
                this.hideSettings();
            }
        };
        
        // 保存设置
        saveBtn.onclick = () => this.saveSettings();
        
        // ESC键关闭
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.hideSettings();
            }
        });
    }
    
    hideSettings() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'none';
    }
    
    async saveSettings() {
        const monitorInterval = document.getElementById('monitorInterval').value;
        const barkBaseUrl = document.getElementById('barkBaseUrl').value;
        const authKey = document.getElementById('authKey').value;
        
        if (!authKey.trim()) {
            this.showNotification('请输入身份验证密钥');
            return;
        }
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    auth: authKey.trim(),
                    monitorInterval: monitorInterval ? parseInt(monitorInterval) : undefined,
                    barkBaseUrl: barkBaseUrl.trim()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(result.message || '设置已保存');
                this.hideSettings();
                
                // 在开发模式下立即更新定时器
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    this.isUpdatingSettings = true; // 标记这是设置更新
                    await this.updateDevTimer();
                }
            } else {
                this.showNotification(result.error || '保存设置失败');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('保存设置失败');
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new OpenRouterMonitor();
    });
} else {
    new OpenRouterMonitor();
}
`;
  }

  /**
   * API endpoint to get only free models
   */
  async getFreeModelsApi(request) {
    try {
      const data = await this.kv.get('models_data');
      if (!data) {
        return new Response(JSON.stringify({
          error: 'No models data available',
          message: 'Run monitoring first to collect data'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const modelsData = JSON.parse(data);
      return new Response(JSON.stringify({
        success: true,
        data: modelsData.freeModels || [],
        timestamp: modelsData.timestamp,
        totalCount: (modelsData.freeModels || []).length
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error getting free models data:', error);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve free models data',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Settings endpoint - handles GET and POST for settings
   */
  async handleSettings(request) {
    const authKey = this.env.SETTINGS_AUTH_KEY;
    if (!authKey) {
      return new Response(JSON.stringify({
        error: 'Settings authentication not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'GET') {
      return this.getSettings();
    } else if (request.method === 'POST') {
      return this.updateSettings(request, authKey);
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const settings = await this.kv.get('app_settings');
      const parsedSettings = settings ? JSON.parse(settings) : {};
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          monitorInterval: parsedSettings.monitorInterval || 5,
          barkBaseUrl: parsedSettings.barkBaseUrl || '',
          lastUpdated: parsedSettings.lastUpdated || null
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error getting settings:', error);
      return new Response(JSON.stringify({
        error: 'Failed to get settings',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Update settings with authentication
   */
  async updateSettings(request, authKey) {
    try {
      const data = await request.json();
      const { auth, monitorInterval, barkBaseUrl } = data;

      // Verify authentication
      if (auth !== authKey) {
        return new Response(JSON.stringify({
          error: '身份验证失败'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate inputs
      if (monitorInterval && (monitorInterval < 1 || monitorInterval > 60)) {
        return new Response(JSON.stringify({
          error: '监控间隔必须在1-60分钟之间'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (barkBaseUrl && !barkBaseUrl.startsWith('https://')) {
        return new Response(JSON.stringify({
          error: 'Bark URL必须以https://开头'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get current settings
      const currentSettings = await this.kv.get('app_settings');
      const settings = currentSettings ? JSON.parse(currentSettings) : {};

      // Update settings
      if (monitorInterval !== undefined) {
        settings.monitorInterval = parseInt(monitorInterval);
      }
      if (barkBaseUrl !== undefined) {
        settings.barkBaseUrl = barkBaseUrl.trim();
      }
      settings.lastUpdated = new Date().toISOString();

      // Save settings
      await this.kv.put('app_settings', JSON.stringify(settings));

      return new Response(JSON.stringify({
        success: true,
        message: '设置已更新',
        data: {
          monitorInterval: settings.monitorInterval,
          barkBaseUrl: settings.barkBaseUrl,
          lastUpdated: settings.lastUpdated
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      return new Response(JSON.stringify({
        error: '更新设置失败',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Status endpoint
   */
  async getStatus() {
    try {
      const lastUpdate = await this.kv.get('last_update');
      const data = await this.kv.get('models_data');
      
      const response = {
        status: 'healthy',
        lastUpdate: lastUpdate || 'Never',
        hasData: !!data
      };

      if (data) {
        const modelsData = JSON.parse(data);
        response.totalModels = modelsData.totalModels || 0;
        response.freeModels = (modelsData.freeModels || []).length;
      }

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: 'error',
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * 测试 Bark 推送端点
   */
  async testBarkNotification() {
    try {
      // 导入 ModelMonitor 类（需要动态导入）
      const { ModelMonitor } = await import('./monitor.js');
      const monitor = new ModelMonitor(this.env);
      
      // 测试 Bark 推送
      const result = await monitor.testBarkNotification();
      
      return new Response(JSON.stringify(result), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error testing Bark notification:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate main HTML page
   */
  async getIndexHTML() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>OpenRouter 模型监控</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 OpenRouter 模型监控</h1>
            <div class="status-bar">
                <div id="status" class="status-indicator">⚪ 加载中...</div>
                <div id="lastUpdate">最后更新: 从未</div>
            </div>
        </header>

        <div class="controls">
            <div class="search-filter">
                <input type="text" id="searchInput" placeholder="🔍 搜索模型..." />
                <select id="sortSelect">
                    <option value="created">按创建时间排序 (新→旧)</option>
                    <option value="name">按名称排序</option>
                    <option value="id">按ID排序</option>
                    <option value="pricing">按价格排序</option>
                    <option value="context">按上下文长度排序</option>
                </select>
                <button id="freeOnlyBtn" class="filter-btn">💰 仅显示免费模型</button>
                <button id="refreshBtn" class="refresh-btn">🔄 刷新</button>
                <button id="settingsBtn" class="settings-btn">⚙️ 设置</button>
            </div>
        </div>

        <div class="stats">
            <div class="stat-item">
                <span class="stat-number" id="totalModels">0</span>
                <span class="stat-label">总模型数</span>
            </div>
            <div class="stat-item">
                <span class="stat-number" id="freeModels">0</span>
                <span class="stat-label">免费模型</span>
            </div>
            <div class="stat-item">
                <span class="stat-number" id="displayedModels">0</span>
                <span class="stat-label">当前显示</span>
            </div>
        </div>

        <div id="loading" class="loading">正在加载模型数据...</div>
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="modelsContainer" class="models-container">
            <!-- Models will be populated here by JavaScript -->
        </div>
    </div>
    
    <!-- 设置模态框 -->
    <div id="settingsModal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>⚙️ 系统设置</h3>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div class="setting-item">
                    <label for="monitorInterval">监控间隔 (分钟):</label>
                    <input type="number" id="monitorInterval" min="1" max="60" placeholder="5" />
                    <small>设置模型监控的时间间隔，范围1-60分钟</small>
                </div>
                <div class="setting-item">
                    <label for="barkBaseUrl">Bark 通知 URL:</label>
                    <input type="url" id="barkBaseUrl" placeholder="https://api.day.app/your_key" />
                    <small>设置 Bark 通知的基础 URL，格式: https://api.day.app/your_key</small>
                </div>
                <div class="setting-item">
                    <label for="authKey">身份验证密钥:</label>
                    <input type="password" id="authKey" placeholder="输入身份验证密钥" />
                    <small>用于验证设置更改的密钥</small>
                </div>
            </div>
            <div class="modal-footer">
                <button id="saveSettings" class="save-btn">保存设置</button>
                <button id="cancelSettings" class="cancel-btn">取消</button>
            </div>
        </div>
    </div>
    
    <script src="/script.js"></script>
</body>
</html>`;
  }

  /**
   * Generate CSS styles
   */
  async getCSS() {
    return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html, body {
    overflow-x: hidden;
    width: 100%;
}

/* 防止长单词溢出 */
* {
    word-wrap: break-word;
    overflow-wrap: break-word;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    color: #212529;
    min-height: 100vh;
    line-height: 1.5;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 30px;
    background: rgba(255, 255, 255, 0.9);
    padding: 30px;
    border-radius: 16px;
    border: 1px solid rgba(255, 122, 0, 0.3);
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

h1 {
    color: #ff7a00;
    font-size: 2.8em;
    font-weight: 700;
    margin-bottom: 15px;
    text-shadow: 0 0 30px rgba(255, 122, 0, 0.3);
}

.status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    font-size: 1em;
    color: #6c757d;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #212529;
}

.controls {
    background: rgba(255, 255, 255, 0.8);
    padding: 25px;
    border-radius: 16px;
    margin-bottom: 25px;
    border: 1px solid rgba(255, 122, 0, 0.2);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.search-filter {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
}

#searchInput {
    flex: 1;
    min-width: 300px;
    padding: 14px 18px;
    border: 2px solid rgba(255, 122, 0, 0.3);
    border-radius: 10px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.9);
    color: #212529;
    transition: all 0.3s ease;
}

#searchInput:focus {
    outline: none;
    border-color: #ff7a00;
    box-shadow: 0 0 0 3px rgba(255, 122, 0, 0.1);
}

#searchInput::placeholder {
    color: #666;
}

#sortSelect {
    padding: 14px 18px;
    border: 2px solid rgba(255, 122, 0, 0.3);
    border-radius: 10px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.9);
    color: #212529;
    cursor: pointer;
    transition: all 0.3s ease;
}

#sortSelect:focus {
    outline: none;
    border-color: #ff7a00;
}

.filter-btn, .refresh-btn, .settings-btn {
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: none;
}

.filter-btn {
    background: linear-gradient(135deg, #ff7a00, #ff9500);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 122, 0, 0.3);
}

.filter-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 122, 0, 0.4);
}

.filter-btn.active {
    background: linear-gradient(135deg, #e53e3e, #c53030);
    box-shadow: 0 4px 15px rgba(229, 62, 62, 0.3);
}

.refresh-btn, .settings-btn {
    background: rgba(255, 122, 0, 0.1);
    color: #ff7a00;
    border: 2px solid rgba(255, 122, 0, 0.3);
}

.refresh-btn:hover, .settings-btn:hover {
    background: rgba(255, 122, 0, 0.2);
    transform: translateY(-2px);
}

.refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.refresh-btn.refreshing {
    cursor: wait;
}

.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-item {
    background: rgba(255, 255, 255, 0.9);
    padding: 25px;
    border-radius: 16px;
    text-align: center;
    border: 1px solid rgba(255, 122, 0, 0.2);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
}

.stat-item:hover {
    border-color: rgba(255, 122, 0, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.stat-number {
    display: block;
    font-size: 3em;
    font-weight: 800;
    color: #ff7a00;
    margin-bottom: 8px;
    text-shadow: 0 0 20px rgba(255, 122, 0, 0.3);
}

.stat-label {
    color: #6c757d;
    font-size: 0.9em;
    font-weight: 500;
    letter-spacing: 1px;
}

.loading, .error {
    text-align: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    border: 1px solid rgba(255, 122, 0, 0.2);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    font-size: 1.2em;
    color: #212529;
}

.error {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.3);
    background: rgba(139, 0, 0, 0.1);
}

.models-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 20px;
}

@media (max-width: 900px) {
    .models-container {
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 16px;
    }
}

.model-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 16px;
    padding: 25px;
    border: 1px solid rgba(255, 122, 0, 0.2);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    position: relative;
}

.model-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 122, 0, 0.4);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

.model-card.free {
    border-left: 4px solid #10b981;
    background: rgba(16, 185, 129, 0.05);
}

.model-card.free::before {
    content: '';
    position: absolute;
    top: 0;
    left: 4px;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 0 16px 0 0;
}

.model-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    gap: 12px;
}

.model-info {
    flex: 1;
    min-width: 0;
}

.model-name {
    font-size: 1.4em;
    font-weight: 700;
    color: #ff7a00;
    margin-bottom: 8px;
    line-height: 1.3;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
}

.model-id {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    color: #6c757d;
    font-size: 0.9em;
    background: rgba(248, 249, 250, 0.8);
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 122, 0, 0.2);
}

.model-id:hover {
    background: rgba(255, 122, 0, 0.1);
    color: #ff7a00;
    border-color: rgba(255, 122, 0, 0.3);
}

.free-badge {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    flex-shrink: 0;
    white-space: nowrap;
}

.model-description {
    color: #495057;
    font-size: 0.95em;
    line-height: 1.6;
    margin-bottom: 20px;
    max-height: 60px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
}

.model-description.expanded {
    max-height: none;
}

.model-description:not(.expanded)::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    height: 20px;
    width: 100%;
    background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.95));
}

.expand-toggle {
    color: #ff7a00;
    font-size: 0.85em;
    cursor: pointer;
    margin-top: 5px;
    display: inline-block;
}

.expand-toggle:hover {
    text-decoration: underline;
}

.model-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-top: 20px;
}

.detail-item {
    text-align: center;
    padding: 12px;
    background: rgba(248, 249, 250, 0.6);
    border-radius: 8px;
    border: 1px solid rgba(255, 122, 0, 0.15);
    transition: all 0.3s ease;
}

.detail-item:hover {
    border-color: rgba(255, 122, 0, 0.3);
    background: rgba(248, 249, 250, 0.8);
}

.detail-label {
    display: block;
    font-size: 0.75em;
    color: #6c757d;
    font-weight: 500;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.detail-value {
    display: block;
    font-weight: 600;
    color: #212529;
    font-size: 0.9em;
}

.detail-value.highlight {
    color: #ff7a00;
}

.detail-value.free {
    color: #10b981;
}

.expandable-section {
    margin-top: 15px;
    border-top: 1px solid rgba(255, 122, 0, 0.2);
    padding-top: 15px;
}

.expandable-header {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #ff7a00;
    font-weight: 600;
    font-size: 0.9em;
    margin-bottom: 10px;
    transition: color 0.3s ease;
}

.expandable-header:hover {
    color: #ff9500;
}

.expandable-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
}

.expandable-content.expanded {
    max-height: 500px;
}

.copy-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
    z-index: 1000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}

.copy-notification.show {
    opacity: 1;
    transform: translateX(0);
}

/* 模态框样式 */
.modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
}

.modal-content {
    background: rgba(255, 255, 255, 0.95);
    margin: 10% auto;
    padding: 0;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 122, 0, 0.2);
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-50px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    padding: 20px 25px;
    border-bottom: 1px solid rgba(255, 122, 0, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    color: #ff7a00;
    font-size: 1.3em;
    font-weight: 600;
}

.close {
    font-size: 24px;
    font-weight: bold;
    color: #6c757d;
    cursor: pointer;
    transition: color 0.3s ease;
}

.close:hover {
    color: #ff7a00;
}

.modal-body {
    padding: 25px;
}

.setting-item {
    margin-bottom: 20px;
}

.setting-item label {
    display: block;
    margin-bottom: 8px;
    color: #212529;
    font-weight: 600;
    font-size: 0.9em;
}

.setting-item input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid rgba(255, 122, 0, 0.2);
    border-radius: 8px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.8);
    color: #212529;
    transition: all 0.3s ease;
    box-sizing: border-box;
}

.setting-item input:focus {
    outline: none;
    border-color: #ff7a00;
    box-shadow: 0 0 0 3px rgba(255, 122, 0, 0.1);
}

.setting-item small {
    display: block;
    margin-top: 5px;
    color: #6c757d;
    font-size: 0.8em;
    line-height: 1.4;
}

.modal-footer {
    padding: 20px 25px;
    border-top: 1px solid rgba(255, 122, 0, 0.2);
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.save-btn, .cancel-btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.save-btn {
    background: linear-gradient(135deg, #ff7a00, #ff9500);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 122, 0, 0.3);
}

.save-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 122, 0, 0.4);
}

.cancel-btn {
    background: rgba(108, 117, 125, 0.1);
    color: #6c757d;
    border: 2px solid rgba(108, 117, 125, 0.3);
}

.cancel-btn:hover {
    background: rgba(108, 117, 125, 0.2);
    transform: translateY(-2px);
}

@media (max-width: 768px) {
    .container {
        padding: 12px;
        max-width: 100%;
        overflow-x: hidden;
    }
    
    header {
        padding: 15px;
        margin-bottom: 15px;
    }
    
    h1 {
        font-size: 1.8em;
        margin-bottom: 8px;
    }
    
    .controls {
        padding: 15px;
        margin-bottom: 15px;
    }
    
    .search-filter {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }
    
    #searchInput {
        min-width: auto;
        width: 100%;
        font-size: 16px; /* 防止iOS缩放 */
        box-sizing: border-box;
    }
    
    #sortSelect {
        width: 100%;
        font-size: 16px;
        box-sizing: border-box;
    }
    
    .filter-btn, .refresh-btn, .settings-btn {
        width: 100%;
        padding: 14px 16px;
        font-size: 16px;
        box-sizing: border-box;
    }
    
    .modal-content {
        margin: 5% auto;
        width: 95%;
        max-width: none;
    }
    
    .modal-header, .modal-body, .modal-footer {
        padding: 15px 20px;
    }
    
    .modal-footer {
        flex-direction: column;
    }
    
    .save-btn, .cancel-btn {
        width: 100%;
        margin-bottom: 8px;
    }
    
    .stats {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 15px;
    }
    
    .stat-item {
        padding: 12px 8px;
    }
    
    .stat-number {
        font-size: 1.6em;
        margin-bottom: 3px;
    }
    
    .stat-label {
        font-size: 0.75em;
    }
    
    .models-container {
        grid-template-columns: 1fr;
        gap: 12px;
        width: 100%;
    }
    
    .model-card {
        padding: 15px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
    }
    
    .model-header {
        margin-bottom: 12px;
        gap: 8px;
    }
    
    .model-info {
        flex: 1;
        min-width: 0;
    }
    
    .model-name {
        font-size: 1.1em;
        line-height: 1.3;
        margin-bottom: 6px;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    .model-id {
        font-size: 0.8em;
        padding: 4px 8px;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    .model-description {
        font-size: 0.85em;
        max-height: 40px;
        line-height: 1.4;
    }
    
    .model-details {
        grid-template-columns: 1fr;
        gap: 6px;
        margin-top: 12px;
    }
    
    .detail-item {
        padding: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
    }
    
    .detail-label {
        font-size: 0.7em;
        margin-bottom: 0;
        margin-right: 8px;
        flex-shrink: 0;
    }
    
    .detail-value {
        font-size: 0.8em;
        text-align: right;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    
    .status-bar {
        flex-direction: column;
        gap: 6px;
        text-align: center;
    }
    
    .expandable-header {
        font-size: 0.8em;
        padding: 6px 0;
    }
    
    .expandable-section {
        margin-top: 10px;
        padding-top: 10px;
    }
    
    .free-badge {
        font-size: 0.7em;
        padding: 4px 10px;
        flex-shrink: 0;
        white-space: nowrap;
    }
}

@media (max-width: 480px) {
    .container {
        padding: 8px;
    }
    
    header {
        padding: 12px;
    }
    
    h1 {
        font-size: 1.6em;
        margin-bottom: 6px;
    }
    
    .controls {
        padding: 12px;
    }
    
    .stats {
        grid-template-columns: 1fr;
        gap: 6px;
    }
    
    .stat-item {
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
    }
    
    .stat-number {
        font-size: 1.4em;
        margin-bottom: 0;
    }
    
    .stat-label {
        font-size: 0.7em;
    }
    
    .model-card {
        padding: 12px;
    }
    
    .model-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 10px;
    }
    
    .model-info {
        width: 100%;
    }
    
    .model-name {
        font-size: 1em;
        line-height: 1.2;
    }
    
    .model-id {
        font-size: 0.75em;
        padding: 3px 6px;
    }
    
    .model-description {
        font-size: 0.8em;
        max-height: 36px;
    }
    
    .model-details {
        grid-template-columns: 1fr;
        gap: 4px;
        margin-top: 10px;
    }
    
    .detail-item {
        padding: 6px;
        font-size: 0.8em;
    }
    
    .detail-label {
        font-size: 0.65em;
    }
    
    .detail-value {
        font-size: 0.75em;
    }
    
    .free-badge {
        font-size: 0.65em;
        padding: 3px 8px;
        align-self: flex-start;
    }
    
    .expandable-header {
        font-size: 0.75em;
        padding: 4px 0;
    }
}`;
  }
}
