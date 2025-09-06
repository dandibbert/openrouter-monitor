/**
 * OpenRouter Free Models Monitor
 * Cloudflare Worker for monitoring OpenRouter API and tracking free models
 */

import { ModelMonitor } from './monitor.js';
import { WebInterface } from './web.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Initialize monitor and web interface
      const monitor = new ModelMonitor(env);
      const webInterface = new WebInterface(env);

      // Handle different routes
      if (path === '/api/models') {
        // API endpoint to get all models data
        return await webInterface.getModelsApi(request);
      } else if (path === '/api/free-models') {
        // API endpoint to get only free models
        return await webInterface.getFreeModelsApi(request);
      } else if (path === '/api/monitor/run') {
        // Manual trigger for monitoring (for testing)
        return await monitor.runMonitoring();
      } else if (path === '/api/status') {
        // Status endpoint
        return await webInterface.getStatus();
      } else if (path.startsWith('/api/')) {
        // Unknown API endpoint
        return new Response('API endpoint not found', { status: 404 });
      } else {
        // Serve web interface
        return await webInterface.serveWeb(path);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error: ' + error.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },

  // Scheduled event for periodic monitoring
  async scheduled(controller, env, ctx) {
    try {
      const monitor = new ModelMonitor(env);
      await monitor.runMonitoring();
    } catch (error) {
      console.error('Scheduled monitoring error:', error);
    }
  }
};
