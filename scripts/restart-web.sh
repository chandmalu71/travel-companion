#!/bin/bash
# Restart web dev server with fresh cache
# Run from project root: ./scripts/restart-web.sh

echo "🔄 Stopping web dev server..."
pkill -f "next dev --port 3001" 2>/dev/null
sleep 1

echo "🗑️  Clearing .next cache..."
rm -rf packages/web/.next

echo "🚀 Starting web dev server on port 3001..."
cd packages/web && npx next dev --port 3001 &

echo "✅ Web server restarting. Wait 3-5 seconds then refresh browser."
echo "   URL: http://localhost:3001"
