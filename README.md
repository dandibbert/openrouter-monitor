# OpenRouter Free Models Monitor

A comprehensive monitoring tool for tracking free models available through the OpenRouter API. Built to deploy on Cloudflare Workers with real-time notifications via Bark.

## 🚀 Features

- **Real-time Monitoring**: Automatically fetch and track OpenRouter models every 1-5 minutes
- **Free Model Detection**: Intelligently identifies free models (both `:free` suffix and zero-cost models)
- **Change Notifications**: Get instant iOS notifications via Bark when free models are added or removed
- **Web Interface**: Beautiful, responsive web UI to browse all models
- **Advanced Filtering**: Search, sort, and filter models with ease
- **One-Click Copy**: Copy model IDs directly to clipboard
- **Mobile Friendly**: Fully responsive design for all devices

## 🏗️ Architecture

- **Backend**: Cloudflare Worker with scheduled triggers
- **Storage**: Cloudflare KV for persistent data storage
- **Frontend**: Vanilla JavaScript SPA served directly from the worker
- **Notifications**: Bark API integration for iOS push notifications

## 📋 Prerequisites

- Cloudflare account with Workers and KV enabled
- Node.js and npm installed locally
- (Optional) Bark app installed on iOS device for notifications
- (Optional) OpenRouter API key for higher rate limits

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd openrouter-monitor
npm install
```

### 2. Configure Cloudflare Workers

```bash
# Login to Cloudflare (if not already done)
npx wrangler login

# Create a KV namespace for data storage
npx wrangler kv:namespace create "OPENROUTER_KV"
npx wrangler kv:namespace create "OPENROUTER_KV" --preview

# Update wrangler.toml with the KV namespace IDs returned from above commands
```

### 3. Set Environment Variables

Configure the following environment variables using Wrangler secrets:

```bash
# Required: Your Bark notification URL (get from Bark app)
npx wrangler secret put BARK_API_URL
# Enter: https://api.day.app/YOUR_BARK_KEY/

# Optional: OpenRouter API key for higher rate limits
npx wrangler secret put OPENROUTER_API_KEY
# Enter your OpenRouter API key

# Optional: Custom monitoring interval (default: 5 minutes)
npx wrangler secret put MONITOR_INTERVAL_MINUTES
# Enter: 5 (or your preferred interval)
```

### 4. Configure wrangler.toml

Update `wrangler.toml` with your KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "OPENROUTER_KV"
id = "your-kv-namespace-id-here"
preview_id = "your-preview-kv-namespace-id-here"
```

### 5. Set up Scheduled Monitoring

Add a cron trigger to your `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

### 6. Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy

# For development/testing
npm run dev
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BARK_API_URL` | Your Bark notification URL | Yes | - |
| `OPENROUTER_API_KEY` | OpenRouter API key | No | - |
| `MONITOR_INTERVAL_MINUTES` | Monitoring frequency | No | 5 |

### Bark Setup

1. Install [Bark](https://apps.apple.com/app/bark-customed-notifications/id1403753865) from the App Store
2. Open the app and copy your unique URL
3. Set the `BARK_API_URL` environment variable to: `https://api.day.app/YOUR_KEY/`

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface |
| `/api/models` | GET | Get all models data |
| `/api/free-models` | GET | Get only free models |
| `/api/status` | GET | Service status and stats |
| `/api/monitor/run` | GET | Manually trigger monitoring |

## 🎨 Web Interface Features

- **Search**: Real-time search across model names, IDs, and descriptions
- **Sorting**: Sort by name, ID, pricing, or context length
- **Filtering**: Toggle between all models and free models only
- **Copy to Clipboard**: Click any model ID to copy it instantly
- **Auto-refresh**: Interface refreshes every 5 minutes automatically
- **Responsive Design**: Works perfectly on mobile and desktop

## 🔄 How It Works

1. **Scheduled Monitoring**: Every 5 minutes (configurable), the worker fetches the latest models from OpenRouter's API
2. **Free Model Detection**: The system identifies free models by:
   - Models with IDs ending in `:free`
   - Models with both prompt and completion prices of $0.00
3. **Change Detection**: Compares current free models with previously stored data
4. **Notifications**: If changes are detected, sends a detailed notification via Bark
5. **Web Interface**: Serves a responsive web interface showing all models with filtering and search capabilities

## 🚨 Monitoring and Alerts

The system will notify you via Bark when:
- ✅ New free models are detected
- ❌ Previously free models are no longer available
- 🚨 API errors or system failures occur

Notification format:
```
OpenRouter Free Models Update:

✅ Added (2):
• GPT-4 Turbo:free
• Claude-3-Haiku:free

❌ Removed (1):
• Llama-2-70B:free
```

## 🛠️ Development

### Local Development

```bash
npm run dev
```

### Project Structure

```
openrouter-monitor/
├── src/
│   └── worker/
│       ├── index.js      # Main worker entry point
│       ├── monitor.js    # Monitoring logic
│       └── web.js        # Web interface handler
├── scripts/
│   └── build-frontend.js # Build script
├── wrangler.toml         # Cloudflare Workers config
└── package.json
```

### Building

```bash
npm run build
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the logs in Cloudflare Workers dashboard
2. Verify KV namespace configuration
3. Test API endpoints manually
4. Check Bark URL format

## 🔮 Future Enhancements

- [ ] Email notifications support
- [ ] Webhook integrations
- [ ] Historical data and trends
- [ ] Custom filtering rules
- [ ] Model comparison features
- [ ] Export functionality
