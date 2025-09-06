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
}`;
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
        this.currentSort = 'name';
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
            this.refresh();
        });

        // Auto refresh every 5 minutes
        setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
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
                statusElement.innerHTML = '🟢 Online';
            } else {
                statusElement.innerHTML = '🔴 Error';
            }
            
            if (status.lastUpdate && status.lastUpdate !== 'Never') {
                const date = new Date(status.lastUpdate);
                lastUpdateElement.textContent = 'Last update: ' + date.toLocaleString();
            }
        } catch (error) {
            console.error('Error loading status:', error);
            document.getElementById('status').innerHTML = '🟡 Unknown';
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
            container.innerHTML = '<div class="no-results">No models found matching your criteria.</div>';
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

    createModelCard(model) {
        const isFree = this.isFreeModel(model);
        const promptPrice = model.pricing ? parseFloat(model.pricing.prompt || '0') : 0;
        const completionPrice = model.pricing ? parseFloat(model.pricing.completion || '0') : 0;
        
        return \`
        <div class="model-card \${isFree ? 'free' : ''}">
            <div class="model-header">
                <div>
                    <div class="model-name">\${model.name || model.id || 'Unnamed Model'}</div>
                    <div class="model-id" title="Click to copy">\${model.id || ''}</div>
                </div>
                \${isFree ? '<div class="free-badge">Free</div>' : ''}
            </div>
            
            \${model.description ? \`<div class="model-description">\${model.description}</div>\` : ''}
            
            <div class="model-details">
                <div class="detail-item">
                    <span class="detail-label">Prompt Price</span>
                    <span class="detail-value">\$\${promptPrice.toFixed(6)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Completion Price</span>
                    <span class="detail-value">\$\${completionPrice.toFixed(6)}</span>
                </div>
                \${model.context_length ? \`
                <div class="detail-item">
                    <span class="detail-label">Context Length</span>
                    <span class="detail-value">\${parseInt(model.context_length).toLocaleString()}</span>
                </div>
                \` : ''}
                \${model.top_provider ? \`
                <div class="detail-item">
                    <span class="detail-label">Provider</span>
                    <span class="detail-value">\${model.top_provider.name || 'Unknown'}</span>
                </div>
                \` : ''}
            </div>
        </div>
        \`;
    }

    toggleFreeOnly() {
        this.showFreeOnly = !this.showFreeOnly;
        const btn = document.getElementById('freeOnlyBtn');
        
        if (this.showFreeOnly) {
            btn.classList.add('active');
            btn.textContent = '🔄 Show All Models';
        } else {
            btn.classList.remove('active');
            btn.textContent = '💰 Free Models Only';
        }
        
        this.filterAndDisplayModels();
    }

    async refresh() {
        await this.loadData();
        await this.loadStatus();
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Model ID copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Model ID copied to clipboard!');
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
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new OpenRouterMonitor();
    });
} else {
    new OpenRouterMonitor();
}`;
  }
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
   * Generate main HTML page
   */
  async getIndexHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenRouter Models Monitor</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 OpenRouter Models Monitor</h1>
            <div class="status-bar">
                <div id="status" class="status-indicator">⚪ Loading...</div>
                <div id="lastUpdate">Last update: Never</div>
            </div>
        </header>

        <div class="controls">
            <div class="search-filter">
                <input type="text" id="searchInput" placeholder="🔍 Search models..." />
                <select id="sortSelect">
                    <option value="name">Sort by Name</option>
                    <option value="id">Sort by ID</option>
                    <option value="pricing">Sort by Price</option>
                    <option value="context">Sort by Context Length</option>
                </select>
                <button id="freeOnlyBtn" class="filter-btn">💰 Free Models Only</button>
                <button id="refreshBtn" class="refresh-btn">🔄 Refresh</button>
            </div>
        </div>

        <div class="stats">
            <div class="stat-item">
                <span class="stat-number" id="totalModels">0</span>
                <span class="stat-label">Total Models</span>
            </div>
            <div class="stat-item">
                <span class="stat-number" id="freeModels">0</span>
                <span class="stat-label">Free Models</span>
            </div>
            <div class="stat-item">
                <span class="stat-number" id="displayedModels">0</span>
                <span class="stat-label">Displayed</span>
            </div>
        </div>

        <div id="loading" class="loading">Loading models data...</div>
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="modelsContainer" class="models-container">
            <!-- Models will be populated here by JavaScript -->
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

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 30px;
    background: rgba(255, 255, 255, 0.95);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

h1 {
    color: #2d3748;
    font-size: 2.5em;
    margin-bottom: 10px;
}

.status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
    font-size: 0.9em;
    color: #666;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
}

.controls {
    background: rgba(255, 255, 255, 0.95);
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

.search-filter {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    align-items: center;
}

#searchInput {
    flex: 1;
    min-width: 250px;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s ease;
}

#searchInput:focus {
    outline: none;
    border-color: #667eea;
}

#sortSelect {
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    background: white;
    cursor: pointer;
}

.filter-btn, .refresh-btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.filter-btn {
    background: linear-gradient(135deg, #48bb78, #38a169);
    color: white;
}

.filter-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
}

.filter-btn.active {
    background: linear-gradient(135deg, #f56565, #e53e3e);
}

.refresh-btn {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.refresh-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-item {
    background: rgba(255, 255, 255, 0.95);
    padding: 20px;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

.stat-number {
    display: block;
    font-size: 2.5em;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 5px;
}

.stat-label {
    color: #666;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.loading, .error {
    text-align: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    font-size: 1.2em;
}

.error {
    color: #e53e3e;
    background: rgba(254, 226, 226, 0.95);
}

.models-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 20px;
}

.model-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.model-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.model-card.free {
    border-left: 5px solid #48bb78;
}

.model-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
}

.model-name {
    font-size: 1.2em;
    font-weight: bold;
    color: #2d3748;
    margin-bottom: 5px;
}

.model-id {
    font-family: 'Courier New', monospace;
    color: #666;
    font-size: 0.9em;
    background: #f7fafc;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease;
}

.model-id:hover {
    background: #e2e8f0;
}

.free-badge {
    background: linear-gradient(135deg, #48bb78, #38a169);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
}

.model-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-top: 15px;
}

.detail-item {
    text-align: center;
    padding: 10px;
    background: #f7fafc;
    border-radius: 8px;
}

.detail-label {
    display: block;
    font-size: 0.8em;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.detail-value {
    display: block;
    font-weight: 600;
    color: #2d3748;
}

.copy-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #48bb78;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}

.copy-notification.show {
    opacity: 1;
    transform: translateX(0);
}

@media (max-width: 768px) {
    .container {
        padding: 15px;
    }
    
    .search-filter {
        flex-direction: column;
        align-items: stretch;
    }
    
    #searchInput {
        min-width: auto;
    }
    
    .models-container {
        grid-template-columns: 1fr;
    }
    
    .model-details {
        grid-template-columns: repeat(2, 1fr);
    }
}`;
  }
