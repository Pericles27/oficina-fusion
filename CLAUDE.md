# Oficina Fusion — Project Context

## Architecture
Unified financial office system merging Admin_caja (multi-par operations engine, closing) with mesa-demo (UX, roles, e-tickets).

```
oficina-fusion/
├── backend/                    # NestJS 11 + Prisma 6 + PostgreSQL
│   ├── modules/
│   │   ├── auth/               # JWT auth, roles (ADMIN/CADETE), sessions
│   │   ├── operations/         # Multi-par operations engine, commissions
│   │   ├── customers/          # Customer profiles, phones, addresses, accounts
│   │   ├── e-tickets/          # Mobile-first e-ticket delivery system
│   │   ├── closing/            # Professional daily closing (draft→confirmed→reopened)
│   │   ├── quotations/         # Market rate snapshots
│   │   ├── tramites/           # Internal office work items
│   │   ├── agenda/             # Calendar/meetings
│   │   └── expenses/           # Office expenses tracking
│   ├── prisma/schema.prisma    # Unified schema (828 lines, 20+ models)
│   └── src/main.ts
│
├── frontend/                   # Next.js 15 App Router + React 19
│   ├── app/
│   │   ├── admin/              # Operator dashboard (blotter, KPIs, closing)
│   │   └── cadete/             # Simplified cadete panel (guided calculator, e-tickets)
│   ├── components/ui/          # Shared UI components
│   └── lib/
│       ├── caja-store.ts       # State management
│       └── api/                # API client
└── package.json                # Workspace root (pnpm)
```

## Stack
- **Frontend**: Next.js 15, React 19, TypeScript, lucide-react, decimal.js, Zod, sonner
- **Backend**: NestJS 11, Prisma 6, PostgreSQL, passport-jwt, bcryptjs, decimal.js
- **Decimal convention**: All money as @db.Decimal text, NEVER float
- **Precision**: 40 decimal places, HALF_UP rounding

## Business Rules
1. Money saved as canonical decimal text, never float
2. Operations immutable after closing
3. Quotations with historical snapshots (never edited)
4. E-tickets don't show economic data to cadete
5. Roles: ADMIN (everything) + CADETE (only e-tickets and basic operations)
6. Service 13 (Pago de cheques posados) → NEVER IMPLEMENTED

## Decimal Model
All Decimal fields in Prisma use `@db.Decimal(18, N)` format. The type is `Decimal` with optional `?` before the decorator, e.g. `puntos Decimal? @db.Decimal(18, 6)`.

## Current Status
- Schema: 828 lines, has validation errors to fix (9 missing opposite relation fields)
- Auth: Basic implementation exists (auth.service.ts, auth.controller.ts, jwt.strategy.ts) but incomplete
- Operations: DTOs and aggregators exist, service/controller missing
- Customers: DTOs only, service/controller missing
- All other modules (closing, e-tickets, quotations, tramites, agenda, expenses): EMPTY
- Frontend: globals.css, basic pages. No UI components, no admin panel, no cadete panel, no API client, no auth integration

## Commands
- `cd backend && npx prisma generate && npx prisma db migrate` — setup DB
- `cd backend && npx nest start --watch` — start backend
- `cd frontend && npx next dev` — start frontend
