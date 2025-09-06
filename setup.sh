#!/bin/bash

echo "🚀 OpenRouter Monitor Setup Script"
echo "=================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

echo "📝 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare:"
    wrangler login
fi

echo "🗄️  Creating KV namespaces..."

# Create production KV namespace
echo "Creating production KV namespace..."
PROD_KV_ID=$(wrangler kv:namespace create "OPENROUTER_KV" --output json | jq -r '.id')
echo "Production KV ID: $PROD_KV_ID"

# Create preview KV namespace
echo "Creating preview KV namespace..."
PREVIEW_KV_ID=$(wrangler kv:namespace create "OPENROUTER_KV" --preview --output json | jq -r '.id')
echo "Preview KV ID: $PREVIEW_KV_ID"

# Update wrangler.toml with KV IDs
echo "📝 Updating wrangler.toml with KV namespace IDs..."
sed -i.bak "s/id = \"\"/id = \"$PROD_KV_ID\"/" wrangler.toml
sed -i.bak "s/preview_id = \"\"/preview_id = \"$PREVIEW_KV_ID\"/" wrangler.toml

echo "✅ KV namespaces configured successfully!"

echo ""
echo "🔧 Next steps:"
echo "1. Set your Bark API URL:"
echo "   wrangler secret put BARK_API_URL"
echo "   (Enter: https://api.day.app/YOUR_BARK_KEY/)"
echo ""
echo "2. (Optional) Set OpenRouter API key:"
echo "   wrangler secret put OPENROUTER_API_KEY"
echo ""
echo "3. Deploy the worker:"
echo "   npm run deploy"
echo ""
echo "🎉 Setup complete! Run the above commands to finish configuration."
