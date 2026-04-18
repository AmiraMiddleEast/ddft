# Deployment — Dubai Docs Fast Track

Ziel: App läuft unter **https://ddft.amira-ai.com** auf dem vorhandenen Hetzner-VPS, ohne andere Dienste anzufassen.

## Einmalige Vorbereitung (lokal)

### 1. GitHub-Repo anlegen

1. Neues **public** Repo auf GitHub erstellen (z.B. `dubai-docs-fast-track/app`)
2. Lokal Remote hinzufügen und pushen:

```bash
cd "/Users/andreaswilmers/Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app"
git remote add origin https://github.com/<owner>/<repo>.git
git branch -M main
git push -u origin main
```

### 2. DNS konfigurieren

Bei eurem DNS-Anbieter einen A-Record setzen:

```
ddft.amira-ai.com  A  159.69.9.160
```

Warte bis der DNS propagiert ist. Check:

```bash
dig +short ddft.amira-ai.com    # muss 159.69.9.160 zurückgeben
```

**Ohne funktionierenden DNS scheitert Let's Encrypt** — erst warten, dann deployen.

## Erst-Deployment (auf dem Server)

Per SSH auf den Server:

```bash
ssh root@159.69.9.160
```

Script holen und ausführen:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/deploy.sh -o deploy.sh
chmod +x deploy.sh
REPO_URL=https://github.com/<owner>/<repo>.git ./deploy.sh
```

Das Script fragt interaktiv nach:
- **Admin-E-Mail** (dein Login in der App)
- **Admin-Passwort** (min. 12 Zeichen — hidden input)
- **Anthropic API Key**

Alles andere (Node-Install, Nginx-Vhost, HTTPS, PM2, Backups, Cron) läuft automatisch. Dauert ~3-5 Minuten.

## Updates (nach Code-Änderungen)

Lokal ändern → `git push` → auf dem Server:

```bash
ssh root@159.69.9.160 "/var/www/ddft/scripts/update.sh"
```

Oder direkt dort:

```bash
cd /var/www/ddft && ./scripts/update.sh
```

Führt automatisch aus: `git pull` → `npm ci` → `npm run build` → `drizzle-kit push` → `pm2 reload`.

## Was auf dem Server angelegt wird

| Pfad | Zweck |
|------|-------|
| `/var/www/ddft/` | App-Code + data/ (SQLite + Uploads) |
| `/etc/nginx/sites-available/ddft.conf` | Eigener Vhost — nur für `ddft.amira-ai.com` |
| `/etc/letsencrypt/live/ddft.amira-ai.com/` | TLS-Zertifikat (auto-renewal via certbot systemd timer) |
| `/var/backups/ddft/` | Tägliche SQLite + Uploads Backups |
| `/etc/cron.d/ddft-backup` | Backup-Cron, isoliert |
| `ddft` (System-User) | Läuft die App und besitzt `/var/www/ddft` |
| PM2-Prozess `ddft` | Läuft unter User `ddft`, startet beim Boot automatisch |

**Andere Dienste auf dem Server bleiben unangetastet** — eigener Vhost, eigener User, eigener PM2-Prozess, eigener Cron-File, eigenes Daten-Verzeichnis.

## Nützliche Befehle

```bash
# Logs live
sudo -u ddft pm2 logs ddft

# Status
sudo -u ddft pm2 status

# Restart
sudo -u ddft pm2 restart ddft

# Manueller Backup-Test
/usr/local/bin/ddft-backup.sh

# Neuer Admin-User anlegen
sudo -u ddft bash -lc "cd /var/www/ddft && ALLOW_SIGNUP=1 SEED_EMAIL='neu@example.com' SEED_PASSWORD='min-12-zeichen' npm run seed"

# Behörden-Daten neu seeden (falls behoerden_db.json aktualisiert wurde)
sudo -u ddft bash -lc "cd /var/www/ddft && npm run seed:behoerden -- --force"

# CoGS-Datenbank aktualisieren
sudo -u ddft bash -lc "cd /var/www/ddft && npm run seed:cogs"

# Nginx-Config testen
sudo nginx -t

# TLS manuell erneuern
sudo certbot renew
```

## Zugriff beschränken (optional — nur interne Nutzung)

**Variante A — Hetzner Cloud Firewall** (empfohlen wenn ihr feste Office-IPs habt):
- Im Hetzner Cloud Panel: Firewall anlegen, nur Port 22 (SSH) + 80/443 (nur von euren IPs) erlauben

**Variante B — Tailscale** (empfohlen wenn ihr remote arbeitet):
- Tailscale auf Server installieren + auf Team-Geräten
- Nginx nur auf Tailscale-Interface binden statt `listen 80;`

Beides optional — die App hat ja schon better-auth mit Session-Cookies + Rate-Limit auf Login.

## Troubleshooting

**Let's Encrypt schlägt fehl** → DNS zeigt noch nicht auf den Server. `dig +short ddft.amira-ai.com` checken.

**"Address already in use" auf Port 3100** → vermutlich läuft schon was. In `deploy.sh` oben `APP_PORT` auf z.B. `3101` ändern und Nginx-Vhost anpassen.

**PM2-Prozess startet nicht beim Boot** → `systemctl status pm2-ddft.service` checken, ggf. nochmal `pm2 startup systemd -u ddft --hp /var/www/ddft | bash` als root laufen lassen.

**`npm run seed:behoerden` fällt weg / braucht zu lange** → das Seed-Script ruft für 16 Bundesländer Claude auf. Braucht ~5-10 Minuten und kostet einmalig ~$0.30. Schon einmal gelaufen → das Script skippt automatisch dank `data/behoerden-parsed.json`.
