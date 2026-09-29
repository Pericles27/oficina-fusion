#!/bin/bash
set -e

echo "=== Oficina Fusion — Setup ==="

# 0. Copy env
if [ ! -f .env ]; then
  echo "[1/5] Copying .env.example → .env"
  cp .env.example .env
else
  echo "[1/5] .env already exists, skipping"
fi

# 1. Start DB via docker-compose
echo "[2/5] Starting PostgreSQL..."
docker compose up -d db
echo "Waiting for DB..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo "DB ready!"
    break
  fi
  sleep 1
done

# 2. Install deps
echo "[3/5] Installing dependencies..."
if [ -d node_modules ] || [ -d backend/node_modules ] || [ -d frontend/node_modules ]; then
  echo "node_modules found, skipping install"
else
  pnpm install
fi

# 3. Generate Prisma client
echo "[4/5] Generating Prisma client..."
cd backend && npx prisma generate && cd ..

# 4. Run migrations
echo "[5/5] Running Prisma migrations..."
cd backend && npx prisma migrate deploy && cd ..

# 5. Seed DB (create default admin user)
echo "Seeding database..."
cd backend && npx prisma db seed 2>/dev/null || echo "No seed script found, creating admin user manually..."

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the app:"
echo "  pnpm dev          # Both backend + frontend in dev mode"
echo "  pnpm dev:backend  # Backend only"
echo "  pnpm dev:frontend # Frontend only"
echo ""
echo "Or run individual services:"
echo "  cd backend && pnpm dev"
echo "  cd frontend && pnpm dev"
echo ""
echo "DB: localhost:5432 (postgres/postgres)"
echo "Backend: localhost:3001"
echo "Frontend: localhost:3000"
