#!/usr/bin/env bash
# =============================================================
# Oficina Fusion — backup de Postgres (Fly.io) con verificación
#
# Hace pg_dump de la base de producción vía `fly proxy`, lo comprime,
# aplica retención y — si hay destino remoto configurado — lo sube.
#
# FASE 7 del PLAN-PRODUCCION.md. Criterio: un backup sin restauración
# probada no es un backup. Ver verify-restore.sh.
#
# Uso:
#   ./scripts/backup-db.sh              # backup a ~/backups/oficina-fusion
#   BACKUP_DIR=/otro/path ./backup-db.sh
#
# Destino remoto (opcional, recomendado): definir RCLONE_REMOTE, ej.
#   RCLONE_REMOTE=b2:oficina-fusion-backups ./scripts/backup-db.sh
# Las credenciales van en la config de rclone o en el entorno del cron,
# NUNCA en el repo.
# =============================================================
set -euo pipefail

APP_DB="${APP_DB:-oficina-fusion-db}"
APP_BACKEND="${APP_BACKEND:-oficina-fusion-backend}"
DB_NAME="${DB_NAME:-oficina_fusion}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/oficina-fusion}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PROXY_PORT="${PROXY_PORT:-15432}"
FLY="${FLY:-$HOME/.fly/bin/flyctl}"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/oficina-fusion_${TS}.sql.gz"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

command -v "$FLY" >/dev/null 2>&1 || die "flyctl no encontrado en $FLY"
command -v pg_dump >/dev/null 2>&1 || die "pg_dump no encontrado (brew install libpq)"

mkdir -p "$BACKUP_DIR"

# La contraseña se lee del secret DATABASE_URL del backend, que Fly generó
# al hacer `fly pg attach`. Nunca se escribe a disco ni se imprime.
log "Obteniendo credenciales desde el backend..."
DB_URL="$("$FLY" ssh console --app "$APP_BACKEND" -C 'printenv DATABASE_URL' 2>/dev/null | tr -d '\r' | grep '^postgres')" \
  || die "no pude leer DATABASE_URL (¿la máquina está suspendida? probá 'fly machines start')"

# postgres://user:pass@host:5432/db?params  →  partes
DB_USER="$(printf '%s' "$DB_URL" | sed -E 's|^postgres(ql)?://([^:]+):.*|\2|')"
DB_PASS="$(printf '%s' "$DB_URL" | sed -E 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|')"
[ -n "$DB_USER" ] && [ -n "$DB_PASS" ] || die "no pude parsear DATABASE_URL"

log "Abriendo proxy a $APP_DB:$PROXY_PORT..."
"$FLY" proxy "$PROXY_PORT":5432 --app "$APP_DB" >/dev/null 2>&1 &
PROXY_PID=$!
# shellcheck disable=SC2064
trap "kill $PROXY_PID 2>/dev/null || true" EXIT

for i in $(seq 1 30); do
  if nc -z localhost "$PROXY_PORT" 2>/dev/null; then break; fi
  [ "$i" = 30 ] && die "el proxy no levantó en 30s"
  sleep 1
done
log "Proxy listo."

log "Dumpeando $DB_NAME..."
PGPASSWORD="$DB_PASS" pg_dump \
  --host=localhost --port="$PROXY_PORT" \
  --username="$DB_USER" --dbname="$DB_NAME" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
# Un dump vacío o truncado pesa poco: 1KB es imposible con el schema real.
BYTES="$(wc -c < "$OUT" | tr -d ' ')"
[ "$BYTES" -gt 1024 ] || die "el dump pesa $BYTES bytes — sospechoso, lo borro; revisá la conexión"

# Verificación de integridad del gzip: un archivo corrupto no sirve de nada
# y el error tiene que aparecer AHORA, no el día que haya que restaurar.
gzip -t "$OUT" || die "el gzip está corrupto: $OUT"

log "OK: $OUT ($SIZE)"

if [ -n "${RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null 2>&1 || die "RCLONE_REMOTE está definido pero rclone no está instalado"
  log "Subiendo a $RCLONE_REMOTE..."
  rclone copy "$OUT" "$RCLONE_REMOTE" --no-traverse
  log "Subido."
else
  log "AVISO: sin RCLONE_REMOTE — el backup queda SÓLO en esta máquina."
  log "       Un backup local no protege de perder la máquina. Configurá un bucket externo."
fi

log "Aplicando retención ($RETENTION_DAYS días)..."
find "$BACKUP_DIR" -name 'oficina-fusion_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete || true

log "Backups presentes:"
ls -1t "$BACKUP_DIR"/oficina-fusion_*.sql.gz 2>/dev/null | head -5
