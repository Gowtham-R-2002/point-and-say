#!/bin/bash
# ============================================
# Point & Say UI — EC2 One-Time Setup
# ============================================
# Run this ONCE on a fresh EC2 instance (Ubuntu 22.04 or Amazon Linux 2023)
#
# Prerequisites:
#   - EC2 instance with IAM role that has:
#     * bedrock:InvokeModel (for Nova 2 Lite, Nova Premier)
#     * polly:SynthesizeSpeech (for Amazon Polly TTS)
#     * bedrock:InvokeModelWithBidirectionalStream (for Nova 2 Sonic)
#   - Security group: inbound ports 80 (HTTP), 22 (SSH)
#
# Usage:
#   chmod +x deploy/setup-ec2.sh
#   ./deploy/setup-ec2.sh
# ============================================

set -euo pipefail

echo "🚀 Point & Say UI — EC2 Setup"
echo "=============================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "📦 Detected OS: $OS"

# ── Install System Dependencies ──
if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    echo "📦 Installing dependencies (apt)..."
    sudo apt-get update -y
    sudo apt-get install -y nginx git curl python3 python3-pip python3-venv

    # Install Node.js 18 via NodeSource
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi

elif [[ "$OS" == "amzn" || "$OS" == "rhel" || "$OS" == "centos" ]]; then
    echo "📦 Installing dependencies (yum/dnf)..."
    sudo yum install -y nginx git python3 python3-pip

    # Install Node.js 18 via NodeSource
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js 18..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi
else
    echo "❌ Unsupported OS: $OS"
    exit 1
fi

echo "✅ Node $(node --version) | npm $(npm --version) | Python $(python3 --version)"

# ── Install PM2 ──
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# ── Clone or Update Repo ──
APP_DIR="$HOME/point-and-say-ui"
REPO_URL="https://github.com/Gowtham-R-2002/point-and-say.git"

if [ -d "$APP_DIR" ]; then
    echo "📂 Updating existing repo..."
    cd "$APP_DIR"
    git pull origin staging
else
    echo "📂 Cloning repo..."
    git clone -b staging "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── Install Frontend Dependencies ──
echo "📦 Installing frontend dependencies..."
npm install

# ── Setup Python Virtual Environment ──
echo "🐍 Setting up Python environment..."
cd "$APP_DIR/server"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd "$APP_DIR"

# ── Create .env file (if not exists) ──
if [ ! -f "$APP_DIR/.env" ]; then
    echo "⚙️  Creating .env from example..."
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo ""
    echo "⚠️  IMPORTANT: Edit $APP_DIR/.env and add your AWS credentials"
    echo "   Or better: use an IAM role attached to this EC2 instance"
    echo ""
fi

# ── Configure Nginx ──
echo "🌐 Configuring nginx..."
# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Install our config
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/conf.d/point-and-say.conf

# Test and restart
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── Start Services with PM2 ──
echo "🔧 Starting services with PM2..."
cd "$APP_DIR"
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true

echo ""
echo "============================================"
echo "  ✅ Point & Say UI — Setup Complete!"
echo "============================================"
echo ""
echo "  Services:"
echo "    Frontend:  http://localhost:5173 (Vite)"
echo "    Backend:   http://localhost:8000 (FastAPI)"
echo "    Sonic TTS: http://localhost:8001 (Nova 2 Sonic)"
echo "    Nginx:     http://localhost:80   (Reverse Proxy)"
echo ""
echo "  Public URL:"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")
echo "    http://${PUBLIC_IP}"
echo ""
echo "  Commands:"
echo "    pm2 status    — Check service status"
echo "    pm2 logs      — View all logs"
echo "    pm2 restart all — Restart everything"
echo ""
echo "  If using IAM role (recommended):"
echo "    No .env changes needed — AWS SDK auto-detects IAM role"
echo ""
echo "  If using access keys:"
echo "    Edit $APP_DIR/.env with your credentials"
echo "    Then: pm2 restart all"
echo ""
