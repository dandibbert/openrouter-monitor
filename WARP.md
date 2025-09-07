# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

OpenRouter Free Models Monitor is a Cloudflare Worker application that tracks free models from the OpenRouter API and sends notifications via Bark when changes occur. It provides a web interface for browsing models with real-time filtering and search capabilities.

## Core Architecture

**Three-module worker design:**
- `src/worker/index.js` - Main entry point handling routing and event dispatching
- `src/worker/monitor.js` - ModelMonitor class for API polling, change detection, and notifications  
- `src/worker/web.js` - WebInterface class for serving HTML/CSS/JS and API endpoints

**Data flow:**
- Scheduled monitoring (cron trigger) → ModelMonitor → OpenRouter API → Change detection → KV storage → Bark notifications
- Web requests → WebInterface → KV storage → JSON API or embedded SPA

**Key integrations:**
- Cloudflare KV for persistent storage of models data and timestamps
- Bark API for iOS push notifications
- OpenRouter API for model data (with optional API key for higher rate limits)

## Development Commands

### Core Development
```bash
# Local development with hot reload
npm run dev

# Deploy to production
npm run deploy

# Full build process (frontend + worker)
npm run build
```

### Setup and Configuration
```bash
# Initial setup with KV namespace creation
./setup.sh

# Set required environment variables
npx wrangler secret put BARK_API_URL
npx wrangler secret put OPENROUTER_API_KEY  # Optional
npx wrangler secret put MONITOR_INTERVAL_MINUTES  # Optional

# Manual KV namespace management
npx wrangler kv:namespace create "OPENROUTER_KV"
npx wrangler kv:namespace create "OPENROUTER_KV" --preview
```

### Testing and Monitoring
```bash
# Test monitoring endpoint manually
curl https://your-worker.your-subdomain.workers.dev/api/monitor/run

# View logs during development
wrangler dev --local

# Check service status
curl https://your-worker.your-subdomain.workers.dev/api/status
```

## API Endpoints

The worker exposes these endpoints:
- `GET /` - Web interface (serves SPA)
- `GET /api/models` - All models with metadata
- `GET /api/free-models` - Free models only
- `GET /api/status` - Service health and stats
- `GET /api/monitor/run` - Manual monitoring trigger (for testing)

## Free Model Detection Logic

Models are considered "free" if:
1. Model ID ends with `:free` suffix, OR
2. Both `pricing.prompt` and `pricing.completion` are exactly `0`

This logic is implemented identically in both `monitor.js` (backend) and `web.js` (frontend JavaScript).

## Configuration Files

**wrangler.toml**: Cloudflare Workers configuration
- KV namespace bindings (must be populated by setup.sh)
- Cron trigger for 5-minute monitoring intervals
- Environment-specific worker names (production/staging)

**package.json**: Build scripts and dependencies
- Minimal dependencies (only Cloudflare Workers types and wrangler)
- Build process combines frontend generation with worker deployment

## Data Storage Schema

**KV Keys:**
- `models_data`: Complete models dataset with metadata
- `last_update`: ISO timestamp of last successful monitoring run

**models_data structure:**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "totalModels": 150,
  "freeModels": [...], // Array of free model objects
  "allModels": [...] // Complete models array from OpenRouter
}
```

## Notification System

Bark integration sends notifications for:
- ✅ New free models detected
- ❌ Previously free models removed  
- 🚨 Monitoring errors or API failures

Notifications include model names/IDs and are formatted with emojis and counts for easy scanning on mobile devices.

## Frontend Architecture

**Single Page Application (SPA) served directly from worker:**
- No build tools or frameworks - vanilla JavaScript
- CSS-in-JS and HTML-in-JS approach embedded in `web.js`
- Real-time search/filter/sort without API calls
- Auto-refresh every 5 minutes
- Responsive design with glassmorphism styling

**Key frontend features:**
- One-click model ID copying to clipboard
- Toggle between all models and free-only view
- Multi-field search (name, ID, description)
- Sort by name, ID, pricing, or context length

## Environment Variables

**Required:**
- `BARK_API_URL` - Format: `https://api.day.app/YOUR_KEY/`

**Optional:**
- `OPENROUTER_API_KEY` - For higher rate limits
- `MONITOR_INTERVAL_MINUTES` - Override default 5-minute interval

## Deployment Notes

- Worker runs on Cloudflare's edge network with global distribution
- KV storage provides eventual consistency across regions
- Scheduled triggers use cron syntax (`*/5 * * * *` = every 5 minutes)
- No external dependencies or bundling required - pure ES modules

## Troubleshooting Common Issues

**KV namespace not found:** Run `./setup.sh` to create and configure namespaces

**Monitoring not running:** Check cron trigger is configured in wrangler.toml and worker is deployed

**No notifications:** Verify BARK_API_URL format and test with manual `/api/monitor/run` call

**API rate limits:** Add OPENROUTER_API_KEY to increase OpenRouter API limits
