/**
 * PM2 Process Manager Config — Point & Say UI
 *
 * Manages all 3 services:
 *   1. frontend  — Vite dev server (port 5173)
 *   2. backend   — FastAPI/uvicorn (port 8000)
 *   3. sonic     — Nova 2 Sonic TTS microservice (port 8001)
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 logs
 *   pm2 status
 */

const HOME = process.env.HOME || '/home/ubuntu';
const APP_DIR = `${HOME}/point-and-say-ui`;

module.exports = {
  apps: [
    {
      name: 'frontend',
      cwd: APP_DIR,
      script: 'npx',
      args: 'vite --host 0.0.0.0',
      env: {
        NODE_ENV: 'development',
        // Local .env has VITE_API_URL=http://localhost:8000
        // On EC2 behind nginx, we don't set it — defaults to '' (relative URLs)
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: 'backend',
      cwd: `${APP_DIR}/server`,
      script: `${APP_DIR}/server/venv/bin/python3`,
      args: 'main.py',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: 'sonic',
      cwd: APP_DIR,
      script: 'server/sonic/sonic-tts-server.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
