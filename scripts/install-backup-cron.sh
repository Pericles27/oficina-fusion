#!/usr/bin/env bash
# Instala el cron diario de backup (03:00). Idempotente: si ya existe, lo reemplaza.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$HOME/backups/oficina-fusion"
MARKER="# oficina-fusion-backup"

mkdir -p "$LOG_DIR"

# El cron corre con un PATH mínimo: hay que darle las rutas explícitas de
# flyctl y pg_dump o el backup falla silenciosamente a las 3 AM.
LINE="0 3 * * * PATH=/opt/homebrew/opt/libpq/bin:\$HOME/.fly/bin:/opt/homebrew/bin:/usr/bin:/bin $REPO/scripts/backup-db.sh >> $LOG_DIR/backup.log 2>&1 $MARKER"

CURRENT="$(crontab -l 2>/dev/null | grep -v "$MARKER" || true)"
printf '%s\n%s\n' "$CURRENT" "$LINE" | grep -v '^$' | crontab -

echo "Cron instalado:"
crontab -l | grep "$MARKER"
echo
echo "Log: $LOG_DIR/backup.log"
echo
echo "AVISO: sin RCLONE_REMOTE configurado, los backups quedan sólo en esta máquina."
echo "       Ver BACKUPS.md para configurar un bucket externo."
