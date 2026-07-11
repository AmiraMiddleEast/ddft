#!/usr/bin/env bash
# One-off: re-seed the Behörden tables on the production server from the
# committed snapshot + research supplement (no Claude call, --skip-parse).
#
# Run as root in the Hetzner web console (fully typeable, no special chars):
#   bash /var/www/ddft/scripts/reseed-behoerden.sh
#
# Safe/idempotent: the seed does a clean wipe + re-insert from the committed
# data files, so re-running produces the same 332-authority result.
set -euo pipefail
APP_DIR=/var/www/ddft
APP_USER=ddft
echo "==> Re-seeding Behörden (parsed snapshot + research supplement) ..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm run seed:behoerden -- --skip-parse"
echo "==> Done."
