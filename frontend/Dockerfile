# =============================================================
# Oficina Fusion — Frontend (Next.js) production image
# Multi-stage build using pnpm workspace.
# =============================================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
# Instalamos tanto frontend como backend: el build del frontend necesita
# el `prisma` CLI + @prisma/client del paquete backend para generar tipos
# antes de `next build` (el frontend importa @prisma/client, ver dep en
# frontend/package.json).
RUN pnpm install --frozen-lockfile --filter @oficina/frontend... --filter @oficina/backend...

# ---- build ----
FROM deps AS build
COPY backend/prisma ./backend/prisma
COPY backend/package.json ./backend/package.json
COPY frontend ./frontend
# El frontend importa tipos de @prisma/client (ver package.json), por lo que
# necesita el client generado antes de `next build`.
RUN pnpm --filter @oficina/backend db:generate
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @oficina/frontend build

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# pnpm workspaces symlink frontend/node_modules/<pkg> into the pnpm store
# under the monorepo root node_modules/.pnpm — copying only frontend's
# node_modules leaves those symlinks dangling. Copy both, keeping the
# same relative layout as the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/node_modules ./frontend/node_modules
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/package.json ./frontend/package.json

USER nextjs
WORKDIR /app/frontend

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',res=>process.exit(res.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
