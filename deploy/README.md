# Deployment — Point & Say UI

## Architecture

```
                  EC2 Instance (t2.micro / t3.micro)
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Vite Dev │  │ FastAPI  │  │ Sonic TTS Server │  │
│  │ :5173    │  │ :8000    │  │ :8001            │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│           ↑          ↑              ↑               │
│           └──────────┼──────────────┘               │
│                Nginx Reverse Proxy                  │
│                    :80                              │
│  ┌─────────────────────────────────────────────────┐│
│  │ /           → Vite :5173 (frontend + HMR)       ││
│  │ /api/*      → FastAPI :8000 (backend)           ││
│  │ /health     → FastAPI :8000 (health check)      ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Launch EC2 Instance

- **AMI:** Ubuntu 22.04 LTS (free tier eligible)
- **Instance type:** `t2.micro` (free tier) or `t3.micro`
- **Security group:** Inbound rules:
  - SSH (22) from your IP
  - HTTP (80) from anywhere
- **IAM role:** Create a role with these policies:
  - `AmazonBedrockFullAccess` (for Nova models)
  - `AmazonPollyFullAccess` (for TTS)

### 2. SSH In and Run Setup

```bash
# Copy setup script to EC2
scp -i your-key.pem deploy/setup-ec2.sh ubuntu@<EC2_IP>:~/

# SSH into the instance
ssh -i your-key.pem ubuntu@<EC2_IP>

# Run setup (installs everything, starts services)
chmod +x ~/setup-ec2.sh
~/setup-ec2.sh
```

Or after the repo is cloned:
```bash
cd ~/point-and-say-ui
chmod +x deploy/setup-ec2.sh
./deploy/setup-ec2.sh
```

### 3. Visit Your App

Open `http://<EC2_PUBLIC_IP>` in your browser.

## CI/CD — GitHub Actions

Push to `staging` → auto-deploys to EC2.

### Setup GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Public IP of your EC2 (e.g. `54.123.45.67`) |
| `EC2_USER` | `ubuntu` (for Ubuntu AMI) |
| `EC2_SSH_KEY` | Full contents of your `.pem` private key |

### Manual Deploy

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
cd ~/point-and-say-ui
./deploy/deploy.sh
```

## Managing Services

```bash
# Check status
pm2 status

# View logs (all services)
pm2 logs

# View logs for one service
pm2 logs frontend
pm2 logs backend
pm2 logs sonic

# Restart everything
pm2 restart all

# Restart one service
pm2 restart backend
```

## AWS Credentials

**Option A: IAM Role (recommended)**
Attach an IAM role to the EC2 instance. The AWS SDK auto-discovers credentials — no `.env` changes needed.

**Option B: Access Keys**
Edit `~/point-and-say-ui/.env`:
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
```
Then: `pm2 restart all`

## Memory Notes (Free Tier)

t2.micro has 1GB RAM. All 3 services fit but it's tight:
- Vite dev server: ~200-300MB
- FastAPI: ~50-100MB
- Sonic TTS: ~80-150MB
- nginx + OS: ~200MB

If you hit memory issues:
1. Add 1GB swap: `sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
2. Or stop the Sonic server and use Polly-only: `pm2 stop sonic`
