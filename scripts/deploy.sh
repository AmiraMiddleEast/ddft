#!/usr/bin/env bash
#
# Dubai Docs Fast Track — Erst-Deployment auf Hetzner VPS (oder beliebiger Ubuntu 22/24)
#
# DESIGN GOALS
#   - Idempotent: darf mehrfach laufen, bricht nichts
#   - Kein Einmischen in bestehende Dienste (anderer Nginx-Sites, PM2-Prozesse,
#     Cron-Jobs). Alles isoliert unter /var/www/ddft, systemweit nur was
#     ohnehin verwendet wird (Node + PM2 global).
#   - Fragt interaktiv nach Geheimnissen — niemand committet sie ins Repo.
#
# USAGE (auf dem Server als root oder via sudo):
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/deploy.sh -o deploy.sh
#   chmod +x deploy.sh
#   REPO_URL=https://github.com/<owner>/<repo>.git ./deploy.sh
#
# BEFORE YOU RUN
#   1. DNS A-Record für ddft.amira-ai.com → Server-IP muss aktiv sein
#      (sonst scheitert Let's Encrypt)
#   2. Public GitHub-Repo muss existieren und die App enthalten (git push)
#   3. Du brauchst parat: Anthropic-API-Key, Admin-E-Mail, Admin-Passwort

set -euo pipefail

# --------------------------------------------------------------------------
# Konfiguration (hier passen, falls nötig)
# --------------------------------------------------------------------------
APP_NAME="ddft"
APP_USER="ddft"                       # System-User für den Dienst
APP_DIR="/var/www/${APP_NAME}"
DOMAIN="ddft.amira-ai.com"
APP_PORT="3100"                       # Next.js hinter Nginx — NICHT 3000, falls dort schon was läuft
NODE_MAJOR="22"
LE_EMAIL="hello@amira-ai.com"         # für Let's-Encrypt-Benachrichtigungen
BACKUP_DIR="/var/backups/${APP_NAME}"

# --------------------------------------------------------------------------
# Vorabchecks
# --------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root oder via sudo ausführen." >&2
  exit 1
fi
if [[ -z "${REPO_URL:-}" ]]; then
  read -r -p "Git-Repo-URL (https://github.com/...): " REPO_URL
fi
if [[ -z "${REPO_URL}" ]]; then
  echo "REPO_URL fehlt." >&2
  exit 1
fi

echo
echo "==> Konfiguration"
echo "    Domain     : ${DOMAIN}"
echo "    App-Port   : ${APP_PORT}"
echo "    App-Dir    : ${APP_DIR}"
echo "    Repo       : ${REPO_URL}"
echo

# --------------------------------------------------------------------------
# 1) System-Pakete sicherstellen (idempotent — installiert nur wenn fehlend)
# --------------------------------------------------------------------------
echo "==> 1/8 System-Pakete"
apt-get update -y

# Node.js 22 via NodeSource (überspringt, wenn richtige Major-Version schon da)
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" != "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

# Build-Tools für better-sqlite3 (native Module)
apt-get install -y \
  git \
  nginx \
  certbot python3-certbot-nginx \
  build-essential python3 pkg-config \
  sqlite3 \
  ufw

# PM2 global (idempotent)
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2@latest
fi

# --------------------------------------------------------------------------
# 2) System-User + App-Verzeichnis
# --------------------------------------------------------------------------
echo "==> 2/8 System-User + Verzeichnisse"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  adduser --system --group --home "${APP_DIR}" --shell /bin/bash "${APP_USER}"
fi
mkdir -p "${APP_DIR}" "${BACKUP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${BACKUP_DIR}"

# --------------------------------------------------------------------------
# 3) Repo clonen / aktualisieren
# --------------------------------------------------------------------------
echo "==> 3/8 Quellcode holen"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "    Repo existiert schon — aktualisiere"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
fi

# --------------------------------------------------------------------------
# 4) .env.local (interaktiv, nur beim ersten Mal)
# --------------------------------------------------------------------------
echo "==> 4/8 Environment-Datei"
ENV_FILE="${APP_DIR}/.env.local"
if [[ ! -f "${ENV_FILE}" ]]; then
  read -r -p "    Admin-E-Mail (für Login): " ADMIN_EMAIL
  read -r -s -p "    Admin-Passwort (min 12 Zeichen): " ADMIN_PASSWORD; echo
  read -r -s -p "    Anthropic API Key: " ANTHROPIC_KEY; echo

  BETTER_AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"

  cat > "${ENV_FILE}" <<EOF
DATABASE_URL=data/angela.db
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=https://${DOMAIN}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
USD_TO_EUR=0.92
PORT=${APP_PORT}
NODE_ENV=production
EOF
  chmod 600 "${ENV_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

  # Admin-Credentials zwischenspeichern für den Seed-Lauf unten
  echo "${ADMIN_EMAIL}" > /tmp/ddft-admin-email
  echo "${ADMIN_PASSWORD}" > /tmp/ddft-admin-password
  chmod 600 /tmp/ddft-admin-email /tmp/ddft-admin-password
else
  echo "    ${ENV_FILE} existiert bereits — übernehme vorhandene Werte"
fi

# --------------------------------------------------------------------------
# 5) Dependencies + Build + Migration
# --------------------------------------------------------------------------
echo "==> 5/8 Install + Build + DB-Migration"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm ci"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm run build"

# Migration & Seeds nur beim ersten Mal
if [[ ! -f "${APP_DIR}/data/angela.db" ]]; then
  sudo -u "${APP_USER}" mkdir -p "${APP_DIR}/data/uploads" "${APP_DIR}/data/lauflisten"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npx drizzle-kit push --force"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm run seed:cogs"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm run seed:behoerden"

  # Admin-Seed
  if [[ -f /tmp/ddft-admin-email && -f /tmp/ddft-admin-password ]]; then
    ADMIN_EMAIL="$(cat /tmp/ddft-admin-email)"
    ADMIN_PASSWORD="$(cat /tmp/ddft-admin-password)"
    sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && ALLOW_SIGNUP=1 SEED_EMAIL='${ADMIN_EMAIL}' SEED_PASSWORD='${ADMIN_PASSWORD}' npm run seed"
    rm -f /tmp/ddft-admin-email /tmp/ddft-admin-password
  fi
else
  echo "    DB existiert — versuche Migrationen pushen (darf scheitern wenn Schema bereits aktuell)"
  sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npx drizzle-kit push --force" || echo "    → push-Konflikt ignoriert (Schema vermutlich bereits synchron)"
fi

# --------------------------------------------------------------------------
# 6) PM2 — Prozess starten + bei Boot auto-start
# --------------------------------------------------------------------------
echo "==> 6/8 PM2"
# Next.js reads PORT from the process env, NOT from .env.local — pass it
# explicitly so the app binds on ${APP_PORT} instead of the default 3000.
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && PORT=${APP_PORT} pm2 start 'npm start' --name '${APP_NAME}' --update-env || PORT=${APP_PORT} pm2 reload '${APP_NAME}' --update-env"
sudo -u "${APP_USER}" bash -lc "pm2 save"

# Systemd-Integration für den App-User (führt `pm2 resurrect` bei Boot aus)
if ! systemctl is-enabled "pm2-${APP_USER}.service" >/dev/null 2>&1; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${APP_USER}" --hp "${APP_DIR}" | tail -n 1 | bash
fi

# --------------------------------------------------------------------------
# 7) Nginx-Vhost (isoliert — eigener File, berührt andere Sites nicht)
# --------------------------------------------------------------------------
echo "==> 7/8 Nginx + HTTPS"
VHOST="/etc/nginx/sites-available/${APP_NAME}.conf"
cat > "${VHOST}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 30m;   # batch uploads bis ~25 PDFs × 10MB

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        'upgrade';
        proxy_read_timeout 120s;            # Claude-Calls können länger dauern
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf "${VHOST}" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
nginx -t
systemctl reload nginx

# HTTPS via Let's Encrypt (wenn DNS auf diesen Server zeigt)
if ! [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  echo "    Hole TLS-Zertifikat für ${DOMAIN}…"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "${LE_EMAIL}" --redirect
else
  echo "    Let's-Encrypt-Zertifikat existiert bereits"
fi

# --------------------------------------------------------------------------
# 8) Tägliches Backup (SQLite + Uploads + Lauflisten)
# --------------------------------------------------------------------------
echo "==> 8/8 Backup-Cron"
BACKUP_SCRIPT="/usr/local/bin/${APP_NAME}-backup.sh"
cat > "${BACKUP_SCRIPT}" <<EOF
#!/usr/bin/env bash
set -e
DATE=\$(date +%F)
sqlite3 "${APP_DIR}/data/angela.db" ".backup '${BACKUP_DIR}/db-\${DATE}.sqlite'"
tar czf "${BACKUP_DIR}/files-\${DATE}.tgz" -C "${APP_DIR}/data" uploads lauflisten 2>/dev/null || true
find "${BACKUP_DIR}" -name 'db-*' -mtime +30 -delete
find "${BACKUP_DIR}" -name 'files-*' -mtime +30 -delete
EOF
chmod +x "${BACKUP_SCRIPT}"

# Cron-Zeile für root (berührt bestehende cron.d-Files nicht)
CRON_FILE="/etc/cron.d/${APP_NAME}-backup"
cat > "${CRON_FILE}" <<EOF
# ${APP_NAME}-backup — täglich 03:15 Uhr
15 3 * * * root ${BACKUP_SCRIPT}
EOF
chmod 644 "${CRON_FILE}"

# --------------------------------------------------------------------------
# Zusammenfassung
# --------------------------------------------------------------------------
echo
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Deployment abgeschlossen"
echo "═══════════════════════════════════════════════════════════════"
echo
echo "  App läuft unter:    https://${DOMAIN}"
echo "  Verzeichnis:        ${APP_DIR}"
echo "  Logs:               sudo -u ${APP_USER} pm2 logs ${APP_NAME}"
echo "  Status:             sudo -u ${APP_USER} pm2 status"
echo "  Restart:            sudo -u ${APP_USER} pm2 restart ${APP_NAME}"
echo "  Backups:            ${BACKUP_DIR} (täglich 03:15 Uhr)"
echo
echo "  Updates später:     scripts/update.sh auf dem Server ausführen"
echo
