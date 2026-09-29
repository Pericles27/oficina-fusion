# =============================================================
# Oficina Fusion — Backend (NestJS) production image
# Multi-stage build using pnpm workspace.
# =============================================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- deps: install full workspace deps (needed for prisma + build) ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile --filter @oficina/backend...

# ---- build: generate prisma client + compile nest ----
FROM deps AS build
COPY backend ./backend
RUN pnpm --filter @oficina/backend db:generate
RUN pnpm --filter @oficina/backend build

# ---- runtime image ----
# Nota: reutilizamos node_modules de `build` (no `deps`) porque `prisma
# generate` escribe el cliente generado (@prisma/client/.prisma) dentro de
# node_modules — copiar desde `deps` daría un Prisma Client sin generar y
# el backend fallaría al arrancar. Además necesitamos el `prisma` CLI
# (devDependency) disponible porque el entrypoint corre `prisma migrate
# deploy` antes de iniciar el proceso Nest.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/package.json ./backend/package.json

USER nestjs
WORKDIR /app/backend

EXPOSE 3001
# No hay endpoint /health dedicado; usamos un check TCP con node (sin
# depender de curl/wget, no instalados en la imagen alpine mínima) que
# valida que el proceso Nest esté aceptando conexiones en su puerto.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/auth/me',res=>process.exit(res.statusCode?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main"]
