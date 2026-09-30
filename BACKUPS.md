# Backups — Oficina Fusion (FASE 7)

## Qué hay

| Script | Qué hace |
|---|---|
| `scripts/backup-db.sh` | `pg_dump` de la base de producción vía `fly proxy`, comprime, verifica integridad del gzip, aplica retención de 14 días |
| `scripts/verify-restore.sh` | Restaura un dump en un Postgres **limpio** en Docker y verifica schema + conteos. Falla si el dump no sirve |

## Estado verificado

Backup real de producción ejecutado y **restaurado con éxito** en una base limpia:
schema completo, tablas `usuario`/`cliente`/`operacion`/`cierre`/`eticket` presentes.

## Uso manual

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$HOME/.fly/bin:$PATH"
./scripts/backup-db.sh
./scripts/verify-restore.sh          # usa el backup más reciente
```

Requisitos: `flyctl` (autenticado), `pg_dump` (`brew install libpq`), Docker corriendo (sólo para verificar).

## ⚠️ Falta: destino remoto

Hoy los backups quedan **sólo en esta máquina**. Un backup en el mismo lugar que
el original no protege de perder la máquina ni la cuenta.

Para completarlo hace falta un bucket externo (Backblaze B2 es el más barato, ~$6/TB/mes):

```bash
brew install rclone
rclone config          # crear un remote, ej. "b2"
RCLONE_REMOTE=b2:oficina-fusion-backups ./scripts/backup-db.sh
```

**Las credenciales del bucket van en la config de rclone o en el entorno del cron,
NUNCA en el repo. El bucket no debe ser público** — contiene datos de clientes y
movimientos de caja.

## Cron diario

Instalar con:

```bash
./scripts/install-backup-cron.sh
```

Corre todos los días a las 03:00. Log en `~/backups/oficina-fusion/backup.log`.

Verificar que quedó:
```bash
crontab -l | grep oficina-fusion
```

## Restauración real (si hay que usarlo)

```bash
# 1. Verificar que el dump sirve ANTES de tocar producción
./scripts/verify-restore.sh /ruta/al/dump.sql.gz

# 2. Restaurar sobre producción (destructivo: el dump tiene --clean)
export PATH="$HOME/.fly/bin:$PATH"
flyctl proxy 15432:5432 --app oficina-fusion-db &
DB_URL=$(flyctl ssh console --app oficina-fusion-backend -C 'printenv DATABASE_URL')
# parsear usuario/password de DB_URL, luego:
gunzip -c dump.sql.gz | PGPASSWORD=... psql -h localhost -p 15432 -U <user> -d oficina_fusion
```

## Retención

14 días de dumps locales. Ajustable con `RETENTION_DAYS=30 ./scripts/backup-db.sh`.

## Pitfall registrado

`verify-restore.sh` usa `PORT_RESTORE`, no `PORT`. La primera versión usaba `PORT`
y heredaba el valor del entorno de la shell (donde `PORT` es el puerto del backend
NestJS), publicando el contenedor de verificación en un puerto imprevisto.
