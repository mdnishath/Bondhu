#!/usr/bin/env bash
# One-command update for the VPS deployment of Bondhu.
# Usage (on the VPS):  bash /opt/bondhu/deploy.sh
#
# Pulls latest master, rebuilds server (tsc + asset copy) and web (vite),
# then gracefully reloads the pm2 process. The SQLite DB (server/bondhu.db)
# is gitignored and untouched, so live data survives every deploy.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bondhu}"
cd "$APP_DIR"

echo "==> git pull"
git pull --ff-only

echo "==> build server"
( cd server && npm install --no-audit --no-fund && npm run build )

echo "==> build web"
( cd web && npm install --no-audit --no-fund && npm run build )

echo "==> reload pm2"
pm2 reload bondhu --update-env
pm2 save

echo "==> deployed $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"
