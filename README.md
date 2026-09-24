# Oficina Fusion — Sistema Integral de Oficina Financiera

Sistema unificado que fusiona el motor de operaciones de **Admin_caja** con la UX simplificada de **mesa-demo**, más módulos nuevos para la gestión integral de la oficina.

## Arquitectura

```
oficina-fusion/
├── backend/                    # NestJS + Prisma + PostgreSQL
│   ├── modules/
│   │   ├── auth/               # Roles (admin/cadete), sesiones
│   │   ├── operations/         # Motor multi-par, blotter, KPIs
│   │   ├── customers/          # Clientes con perfil completo
│   │   ├── e-tickets/          # E-tickets delivery (mobile-first)
│   │   ├── closing/            # Cierre del día profesional
│   │   ├── quotations/         # Cotizaciones con snapshots
│   │   ├── tramites/           # E-tickets internos de oficina
│   │   ├── agenda/             # Calendario + reuniones
│   │   └── expenses/           # Gastos de oficina
│   ├── prisma/schema.prisma    # Schema unificado
│   └── src/
│
├── frontend/                   # Next.js 15 App Router
│   ├── app/
│   │   ├── admin/              # Panel operador (mesa profesional)
│   │   └── cadete/             # Panel simplificado (calculadora guiada)
│   ├── components/
│   │   └── ui/                 # Componentes compartidos
│   └── lib/                    # Lógica compartida
```

## Stack

| Capa | Tecnología |
|------|-----------|
| UI Admin | Next.js 15 + React 19 + TypeScript |
| UI Cadete | Next.js 15 + React 19 + mobile-first |
| Backend | NestJS + Prisma + PostgreSQL |
| Motor cálculo | decimal.js (precision 40, HALF_UP) |
| Validación | Zod |
| Autenticación | Session table, cookie HttpOnly SameSite=strict |

## Qué trae de cada proyecto

### De Admin_caja
- ✅ Motor de operaciones multi-par (USD/ARS, EUR/USD, etc.)
- ✅ Sistema de cierre profesional (borrador→confirmado→reabierto)
- ✅ API REST con NestJS
- ✅ PostgreSQL
- ✅ Motor de cálculos económicos
- ✅ Panel de operador con blotter y KPIs
- ✅ Cables/wire transfers
- ✅ Comisiones por spread automático

### De mesa-demo
- ✅ UX guiada para cadete (no técnico)
- ✅ Sistema de roles (admin + cadete)
- ✅ E-tickets mobile-first (delivery, confirmar)
- ✅ Cotizador 3 precios (market, client default, operation rate)
- ✅ Perfil completo cliente (teléfonos, direcciones, cuentas)
- ✅ Seguridad (password forced change, login blocking)
- ✅ Dashboard simplificado
- ✅ Balance/saldo simplificado para cadetes

### Nuevos (no existe en ninguno)
- ❌ Módulo de trámites internos (e-tickets de oficina)
- ❌ Módulo de agenda/calendario
- ❌ Módulo de gastos de oficina
- ❌ Panel de seguimiento de objetivos

## Setup

```bash
pnpm setup
```

Esto corre:
1. `pnpm install` — instala dependencias
2. `prisma generate` — genera el cliente Prisma
3. `prisma migrate deploy` — aplica migraciones
4. `prisma db seed` — seed con datos iniciales

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Levanta backend + frontend en desarrollo |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint en todos los packages |
| `pnpm type-check` | Type-check en todos los packages |
| `pnpm db:generate` | `prisma generate` |
| `pnpm db:migrate` | `prisma migrate deploy` |
| `pnpm db:seed` | Seed de datos iniciales |

## Reglas de negocio principales

Ver `backend/src/modules/operations/` para el motor económico completo.

1. El dinero se guarda como texto decimal canónico, nunca float
2. Operaciones inmutables post-cierre
3. Cotizaciones con snapshots históricos (nunca se editan)
4. E-tickets no muestran datos económicos al cadete
5. Roles: admin (todo) + cadete (sólo e-tickets y operaciones básicas)
6. Servicio 13 (Pago de cheques posados) → NO SE HACE
