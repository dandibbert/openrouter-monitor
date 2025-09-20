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
      } else if (path === '/api/settings') {
        // Settings endpoint
        return await webInterface.handleSettings(request);
      } else if (path === '/api/test/bark') {
        // Test Bark notification endpoint
        return await webInterface.testBarkNotification();
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
    const kv = env.OPENROUTER_KV;

    try {
      // Determine desired monitoring interval (default 5 minutes)
      let intervalMinutes = 5;

      if (env.MONITOR_INTERVAL_MINUTES) {
        const envInterval = parseInt(env.MONITOR_INTERVAL_MINUTES, 10);
        if (!Number.isNaN(envInterval)) {
          intervalMinutes = envInterval;
        }
      }

      const settingsRaw = await kv.get('app_settings');
      if (settingsRaw) {
        try {
          const settings = JSON.parse(settingsRaw);
          if (settings && settings.monitorInterval) {
            const parsedInterval = parseInt(settings.monitorInterval, 10);
            if (!Number.isNaN(parsedInterval)) {
              intervalMinutes = parsedInterval;
            }
          }
        } catch (error) {
          console.warn('Failed to parse stored settings for monitor interval:', error);
        }
      }

      // Clamp interval between 1 and 60 minutes
      intervalMinutes = Math.min(Math.max(intervalMinutes, 1), 60);
      const intervalMs = intervalMinutes * 60 * 1000;

      // Determine when monitoring last ran
      const [lastTriggerRaw, lastUpdateRaw] = await Promise.all([
        kv.get('last_monitor_trigger'),
        kv.get('last_update')
      ]);

      let lastRunTimestamp;
      for (const value of [lastTriggerRaw, lastUpdateRaw]) {
        if (!value) {
          continue;
        }

        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
          if (!lastRunTimestamp || parsed > lastRunTimestamp) {
            lastRunTimestamp = parsed;
          }
        }
      }

      const now = Date.now();
      if (lastRunTimestamp) {
        const elapsed = now - lastRunTimestamp;
        if (elapsed < intervalMs) {
          const remainingMs = intervalMs - elapsed;
          console.log(
            `Skipping scheduled monitoring run. Next run allowed in ${Math.ceil(remainingMs / 60000)} minute(s).`
          );
          return;
        }
      }

      await kv.put('last_monitor_trigger', new Date(now).toISOString());

      const monitor = new ModelMonitor(env);
      const response = await monitor.runMonitoring();

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Scheduled monitoring run returned status ${response.status}: ${errorText}`
        );
      }
    } catch (error) {
      console.error('Scheduled monitoring error:', error);
    }
  }
};
