#!/bin/bash
# ============================================
# Point & Say UI — Deploy (pull + restart)
# ============================================
# Called by GitHub Actions or manually on the EC2 instance.
# Pulls latest code and restarts all services.
#
# Usage:
#   ./deploy/deploy.sh
# ============================================

set -euo pipefail

APP_DIR="$HOME/point-and-say-ui"
cd "$APP_DIR"

echo "🔄 Pulling latest code..."
git pull origin staging

echo "📦 Installing frontend dependencies..."
npm install --prefer-offline

echo "🐍 Installing backend dependencies..."
cd server
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
cd "$APP_DIR"

echo "🔄 Restarting services..."
pm2 restart all

echo "⏳ Waiting for services to start..."
sleep 3

echo "📊 Service status:"
pm2 status

echo ""
echo "✅ Deploy complete!"
