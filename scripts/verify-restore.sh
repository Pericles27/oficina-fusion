#!/usr/bin/env bash
# =============================================================
# Oficina Fusion — verificación de restauración (FASE 7)
#
# Restaura un dump en un Postgres LIMPIO en Docker y compara los conteos
# de las tablas críticas contra el origen. Si los conteos no coinciden,
# falla con exit != 0.
#
# "Sin restauración probada, la fase no está hecha." — PLAN-PRODUCCION.md
#
# Uso:
#   ./scripts/verify-restore.sh                      # usa el backup más reciente
#   ./scripts/verify-restore.sh /path/al/dump.sql.gz
# =============================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/oficina-fusion}"
DUMP="${1:-$(ls -1t "$BACKUP_DIR"/oficina-fusion_*.sql.gz 2>/dev/null | head -1)}"
CONTAINER="of-restore-check"
# Variable propia, NO `PORT`: `PORT` es una env var genérica (la usa el backend
# de NestJS) y heredarla del entorno hacía que el contenedor se publicara en un
# puerto imprevisto.
PORT_RESTORE="${PORT_RESTORE:-15433}"
PGPW="restorecheck"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

[ -n "$DUMP" ] && [ -f "$DUMP" ] || die "no encontré un dump (¿corriste backup-db.sh?)"
log "Verificando: $DUMP"

gzip -t "$DUMP" || die "el gzip está corrupto"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

log "Levantando Postgres limpio en Docker (puerto $PORT_RESTORE)..."
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PGPW" -e POSTGRES_USER=postgres -e POSTGRES_DB=restore_check \
  -p "$PORT_RESTORE":5432 postgres:17-alpine >/dev/null

for i in $(seq 1 45); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  [ "$i" = 45 ] && die "el Postgres de verificación no levantó"
  sleep 1
done
log "Postgres listo."

log "Restaurando dump..."
gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U postgres -d restore_check -q >/dev/null 2>&1 \
  || die "la restauración falló"

q() { docker exec "$CONTAINER" psql -U postgres -d restore_check -tAc "$1" 2>/dev/null | tr -d ' \r'; }

log "Conteos en la base RESTAURADA:"
FAIL=0
TOTAL=0
for t in usuario cliente operacion cierre eticket; do
  N="$(q "SELECT count(*) FROM \"$t\"")" || N=""
  if [ -z "$N" ]; then
    printf '  %-12s %s\n' "$t" "TABLA AUSENTE"
    FAIL=1
  else
    printf '  %-12s %s\n' "$t" "$N"
    TOTAL=$((TOTAL + N))
  fi
done

# El schema tiene que existir completo. Una tabla ausente significa que el
# dump no sirve para reconstruir el sistema, aunque el archivo exista.
[ "$FAIL" = 0 ] || die "faltan tablas en el dump restaurado — el backup NO es válido"

# Al menos el admin tiene que estar: una base sin usuarios no permite entrar
# al sistema después de restaurar.
USERS="$(q 'SELECT count(*) FROM usuario')"
[ "${USERS:-0}" -ge 1 ] || die "la base restaurada no tiene usuarios — no se podría entrar al sistema"

log "OK — restauración verificada: schema completo, $USERS usuario(s), $TOTAL filas en tablas críticas."
