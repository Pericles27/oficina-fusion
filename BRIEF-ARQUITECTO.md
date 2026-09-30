# Brief — Oficina Fusion: poner el sistema en funcionamiento real

## Encargo del dueño (Nicolás, textual)

> "Todo el sistema debe estar en funcionamiento real. Para ello tiene que haber
> inicio de sesión, distintas cuentas y los roles necesarios."

Objetivo: que la oficina pueda **usar el sistema de verdad** — login real, cuentas
por persona, permisos por rol. No una demo.

## Repo

`~/Proyectos/oficina-fusion` — monorepo pnpm + turbo.
- `backend/` — NestJS + Prisma + Postgres
- `frontend/` — Next.js 14 App Router, `output: 'export'` (export estático)
- Commit actual: `19e71cf`
- Lee `AGENTS.md` y `.hermes.md` del repo. Hay grafo graphify en `graphify-out/`.

## Estado real, ya verificado (no repitas este relevamiento)

### Backend: FUNCIONA y está en producción

- URL: `https://oficina-fusion-backend.fly.dev` — vivo, `GET /health` → 200
- Fly.io app `oficina-fusion-backend`, región gru, 1 máquina 512MB,
  `auto_stop_machines = "suspend"` + `min_machines_running = 0`
- Postgres unmanaged `oficina-fusion-db` (512MB/1GB vol, ~$3.35/mes). **No es
  Managed Postgres** (ese cuesta $38/mes y el dueño tiene presupuesto de $5):
  sin backups automáticos ni soporte de Fly.
- 3/3 migraciones Prisma aplicadas
- Usuario `admin` creado, rol ADMIN, login verificado (HTTP 200 + JWT válido)
- Secrets seteados en Fly: `DATABASE_URL` (via `fly pg attach`), `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`

Deploy: `cd backend && fly deploy --app oficina-fusion-backend --remote-only --ha=false`

### Frontend: es una MAQUETA, no un cliente del backend

Esto es el corazón del trabajo. Verificado con grep en todo `app/`, `components/`, `lib/`:

1. **Cero llamadas HTTP.** No hay un solo `fetch`, `axios` ni referencia a la URL
   de la API en todo el frontend. `NEXT_PUBLIC_API_URL` no se usa en ningún lado.
2. **Datos hardcodeados** en `lib/caja-store.tsx` (695 líneas): `CLIENTES`
   (Carlos Méndez, Ana Rodríguez… con CBUs inventados), `PARES`, `TRADERS`,
   `seedOps()`. Todo ficticio.
3. **Sin persistencia**: estado en un `useState` (línea ~340). F5 borra todo.
4. **Sin login**: no existe pantalla de login. `app/admin/layout.tsx` hardcodea
   `user: { name: 'Nicolás García', role: 'Administrador', initials: 'NG' }`.
5. **Sin guard de rutas**: `/admin/*` y `/cadete/*` son accesibles sin autenticar.

Páginas existentes (UI ya diseñada, hay que conectarla):
- `app/page.tsx` (home con selector de rol)
- `app/admin/`: `page` (dashboard), `operations`, `customers`, `closing`, `quotation`
- `app/cadete/`: `page`, `tickets`, `tickets/new`, `operations`, `profile`
- Componentes: `AppShell`, `DataList`, `ETicketPanel`, `OperationsBoard`, `components/ui/*`

**Consecuencia**: si esto se publica tal cual, cualquiera con el link entra a
`/admin/closing` y opera el cierre diario. Y quien cargue operaciones las pierde
al recargar. No debe salir a producción sin la integración.

## API del backend (relevada de los controllers)

Guards disponibles: `JwtAuthGuard`, `RolesGuard` + decorador `@Roles(RolUsuario.ADMIN)`.
Roles en el enum: **solo `ADMIN` y `CADETE`**.

```
auth        POST /auth/login          público
            POST /auth/register       ADMIN
            POST /auth/change-password  auth
            POST /auth/logout         auth
            GET  /auth/me             auth
users       GET  /users               ADMIN
            GET  /users/:id           auth
operations  POST /operations          auth
            GET  /operations          auth
            GET  /operations/kpis/par       auth
            GET  /operations/kpis/operador  auth
            GET  /operations/:id      auth
            PUT  /operations/:id      auth
            POST /operations/:id/finalize   auth
            POST /operations/:id/cancel     auth
customers   POST /customers           ADMIN
            GET  /customers           auth
            GET  /customers/:id       auth
            PUT  /customers/:id       ADMIN
            DELETE /customers/:id     ADMIN
            POST /customers/:id/saldo ADMIN
e-tickets   POST /e-tickets           ADMIN
            GET  /e-tickets           auth
            GET  /e-tickets/:id       auth
            PUT  /e-tickets/:id       auth
            POST /e-tickets/:id/confirm  auth
            POST /e-tickets/:id/cancel   ADMIN
closing     TODO controller entero es @Roles(ADMIN)
            POST /closing, GET /closing, GET /closing/:id,
            POST /closing/:id/confirm, POST /closing/:id/reopen
health      GET /health               público
```

**OJO**: los módulos `quotations`, `tramites`, `agenda`, `expenses` están
importados en `app.module.ts` pero quedó sin verificar si tienen controller.
Confirmalo antes de planificar sobre ellos (`ls backend/src/modules/<m>/`).
La página `app/admin/quotation` existe en el frontend, así que importa.

## Schema Prisma — lo que importa para auth

`model Usuario`: `id`, `username` (unique), `passwordHash`, `nombre`,
`roles RolUsuario[]`, `email?`, `activo`, `bloqueado`, `bloqueadoHasta?`,
`intentosFallidos`, `primerLogin`, timestamps.

Hay infraestructura de seguridad **en el schema pero sin usar en el código**:
- `model Sesion` (cookie, expiraEn) — existe pero el auth es JWT stateless
- `bloqueado` / `bloqueadoHasta` / `intentosFallidos` — nadie los incrementa:
  **no hay rate limiting ni lockout por fuerza bruta**
- `primerLogin` — nadie lo fuerza: no hay cambio de contraseña obligatorio
- `model LoginEvent` y `model AuditEvent` — tablas de auditoría sin escribir
- Entidades de negocio: `Operacion`, `Cliente`, `Cierre` (+ 6 tablas hijas),
  `Eticket`, `Tramite`, `Reunion`, `Cable`, `Comision`, `Gasto`, `Par`

## Fixes de seguridad ya aplicados (contexto, no los rehagas)

En el commit `19e71cf`:
1. `POST /auth/register` era **público y aceptaba `roles` del body** → cualquiera
   en internet se hacía ADMIN. Ahora exige `@Roles(ADMIN)`. Verificado: 401.
2. `JWT_SECRET` tenía fallback `'dev-secret-change-in-prod'` en 4 archivos → si
   faltaba la env var, la app arrancaba con secreto público y se podían forjar
   tokens. Centralizado en `backend/src/common/config/jwt-secret.ts`, que tira
   error al arrancar si falta o mide menos de 32 chars.
3. `.gitignore` tenía la línea `backend` → **el backend entero estaba sin
   versionar**. Ya está en git.
4. Agregado `GET /health` (el healthcheck de Fly apuntaba a `/auth/me` → 401 →
   Fly mataba la máquina).

## Lo que te pido

Un **plan de implementación por fases** para llegar a "funcionamiento real",
priorizado, con criterios de aceptación verificables por fase. Carlos
(claude-sonnet-5, full-stack) lo va a ejecutar, así que el plan tiene que ser
accionable por otro agente sin tu contexto: rutas de archivo concretas,
contratos de API, orden de dependencias.

Puntos que necesito que decidas explícitamente:

1. **Login y sesión en un frontend `output: 'export'`.** Es export estático puro,
   sin servidor Next, así que no hay middleware ni server components para guards.
   ¿Se queda en estático con guard client-side (y se asume que la seguridad real
   la impone el backend en cada request), o hay que cambiar a SSR? Si cambia,
   Netlify deja de servir estático y el deploy cambia. Decidí y justificá.
2. **Dónde se guarda el JWT.** localStorage es vulnerable a XSS; cookie httpOnly
   necesita que el backend la setee y CORS con credentials + dominio compartido.
   Con `force_https` en Fly y frontend en Netlify son dominios distintos.
3. **Roles: ¿alcanzan ADMIN y CADETE?** El dueño pidió "distintas cuentas y los
   roles necesarios". Es una oficina financiera con cierre de caja, comisiones y
   saldos de clientes. Evaluá si hace falta un rol intermedio (operador/trader que
   carga operaciones pero no confirma el cierre) y qué implica tocar el enum
   `RolUsuario` (migración + guards + UI).
4. **Gestión de cuentas.** Hoy solo se pueden crear usuarios por `POST
   /auth/register` con token ADMIN (no hay UI). Hace falta pantalla de admin de
   usuarios: crear, desactivar, resetear contraseña, asignar roles.
5. **Seguridad que falta y el schema ya contempla**: lockout por intentos
   fallidos, `primerLogin` forzando cambio de contraseña, escritura de
   `LoginEvent`/`AuditEvent`. Decidí qué entra en el alcance mínimo para que una
   oficina real lo use con plata de verdad, y qué queda para después.
6. **Migración del store demo.** `lib/caja-store.tsx` tiene 695 líneas de estado
   local que alimentan 11 páginas. ¿Se reemplaza por data fetching (React Query /
   SWR), se mantiene el shape del context y se le inyecta data real por debajo, o
   se reescribe? Lo que menos rompa la UI ya hecha.
7. **Riesgo de datos**: el Postgres no tiene backups. Si la oficina empieza a
   cargar operaciones reales y se pierde el volumen, se pierde la contabilidad.
   Decidí si un dump periódico entra en el alcance.

Marcá también qué **no** hay que hacer todavía, para que Carlos no se vaya de
alcance.

Entregá el plan en markdown, en `~/Proyectos/oficina-fusion/PLAN-PRODUCCION.md`,
y devolveme un resumen de las fases y las decisiones de los 7 puntos.

## ADENDA — módulos backend vacíos (verificado)

`quotations`, `tramites`, `agenda` y `expenses` están importados en
`app.module.ts` pero son **`@Module({})` vacíos**: sin controller, sin service,
sin nada. Cuatro áreas del sistema no tienen backend.

Impacta directo en el alcance:
- `app/admin/quotation/` existe en el frontend y no tiene API contra la que hablar.
- El schema Prisma sí tiene `model Tramite`, `Reunion`, `Gasto`, `Par`.

Decidí en el plan qué entra en "funcionamiento real" (probablemente cotizaciones,
si la UI ya está) y qué queda fuera del alcance mínimo.
