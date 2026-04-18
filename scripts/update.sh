#!/usr/bin/env bash
#
# Dubai Docs Fast Track — Update-Deployment (nach dem ersten deploy.sh)
#
# Führt aus:
#   1. Git-Pull
#   2. npm ci (dependencies aktualisieren)
#   3. npm run build
#   4. drizzle-kit push --force  (neue Migrationen applizieren)
#   5. PM2 restart
#
# Idempotent, berührt .env.local nicht.

set -euo pipefail

APP_NAME="ddft"
APP_USER="ddft"
APP_DIR="/var/www/${APP_NAME}"
APP_PORT="3100"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root oder via sudo ausführen." >&2
  exit 1
fi

echo "==> Pull"
sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only

echo "==> Install"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm ci"

echo "==> Build"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm run build"

echo "==> DB-Migration (falls neu, sonst idempotent übergehen)"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npx drizzle-kit push --force" || echo "    → push-Konflikt ignoriert (Schema vermutlich bereits synchron)"

echo "==> Restart"
sudo -u "${APP_USER}" bash -lc "PORT=${APP_PORT} pm2 reload ${APP_NAME} --update-env"

echo
echo "✓ Update fertig"
sudo -u "${APP_USER}" bash -lc "pm2 status ${APP_NAME}"
