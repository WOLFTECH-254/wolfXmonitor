#!/bin/bash
# wolfXmonitor — VPS deploy / update script
# First deploy:  bash deploy.sh
# Re-deploy:     bash deploy.sh
set -e

APP_DIR="/var/www/wolfxmonitor"
LOG_DIR="/var/log/wolfxmonitor"
ENV_FILE="$APP_DIR/.env"

echo "🐺 wolfXmonitor Deploy"
echo "======================"

cd "$APP_DIR"

# Load env so drizzle-kit can reach the DB
set -a; [ -f "$ENV_FILE" ] && source "$ENV_FILE"; set +a

echo "[1/6] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[2/6] Pushing DB schema (safe on fresh DB)..."
pnpm --filter @workspace/db run push

echo "[3/6] Building API server..."
pnpm --filter @workspace/api-server run build

echo "[4/6] Building frontend..."
BASE_URL="/" pnpm --filter @workspace/uptime-monitor run build

echo "[5/6] Ensuring log directory..."
mkdir -p "$LOG_DIR"

echo "[6/6] Starting / restarting PM2..."
pm2 describe wolfxmonitor-api > /dev/null 2>&1 \
  && pm2 restart wolfxmonitor-api \
  || pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

echo ""
echo "✅ Deploy complete!"
echo "   Healthcheck: curl http://localhost:8080/api/healthz"
pm2 status wolfxmonitor-api
