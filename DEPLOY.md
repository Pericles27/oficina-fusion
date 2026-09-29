# =============================================================
# Oficina Fusion — Deploy Guide
# =============================================================
#
# Stack:
#   Frontend (Next.js static): Netlify
#   Backend (NestJS):          Fly.io
#   Database (PostgreSQL):     Fly.io
#
# Cost aproximado:
#   Netlify:   Free (site estático)
#   Fly.io:    ~$5-10/mes (2 VMs + Postgres)
#
# =============================================================

## 1. Backend + Postgres en Fly.io

### 1.1 Instalar flyctl
# macOS: brew install fly
# o: https://fly.io/docs/hands-on/install-flyctl/

### 1.2 Login
fly auth login

### 1.3 Crear app backend
cd oficina-fusion
fly launch --name oficina-fusion-backend --no-deploy
# Elegir "No, I will manually set required features"
# No needs for volumes/redis/mongo

### 1.4 Deploy backend
fly deploy --app oficina-fusion-backend

### 1.5 Crear Postgres cluster
fly postgres launch --name oficina-fusion-db --region gru --size shared-cpu-1gb --password "$(openssl rand -base64 32)"

### 1.6 Conectar backend a Postgres
fly secrets set \
  DATABASE_URL="postgresql://postgres:<password>@<cluster-name>.internal:5432/oficina_fusion" \
  JWT_SECRET="$(openssl rand -base64 48)" \
  JWT_EXPIRES_IN="7d" \
  FRONTEND_URL="https://<your-netlify-site>.netlify.app" \
  PORT=3001 \
  --app oficina-fusion-backend

### 1.7 Ejecutar migrations
fly console --app oficina-fusion-backend --command "cd /app && npx prisma migrate deploy"

## 2. Frontend en Netlify

### 2.1 Conectar repositorio
# Ir a https://app.netlify.com → New site from Git
# Elegir tu repo de GitHub

### 2.2 Configurar build
# Build command: pnpm install && pnpm run build
# Publish directory: frontend/out
# o crear netlify.toml con la configuración incluida

### 2.3 Variables de entorno
NEXT_PUBLIC_API_URL=https://oficina-fusion-backend.fly.dev/api

## 3. DNS (opcional)
# Si tenés dominio propio:
#   A → Netlify IPs
#   CNAME → @ para el subdominio

# =============================================================
# End of Deploy Guide
# =============================================================
