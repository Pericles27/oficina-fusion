# Encargo — FASES 3 y 6 del PLAN-PRODUCCION.md

## Contexto

Repo: `~/Proyectos/oficina-fusion`, branch **`main`** (fases 1 y 2 ya mergeadas, 84/84 tests verde).

Leé `PLAN-PRODUCCION.md` §FASE 3 y §FASE 6 completas antes de empezar. También `AGENTS.md` y `.hermes.md`. Hay grafo graphify en `graphify-out/` — usalo para navegar en vez de grep a ciegas.

Trabajá en branch `feat/fase3-6-store-api` desde `main`. **Commiteá cada paso** — en la sesión anterior se perdió trabajo no commiteado.

## Estado actual verificado

- Backend en producción: `https://oficina-fusion-backend.fly.dev` (Fly.io, región gru)
- Postgres de Fly attachado, 3 migraciones + la de OPERADOR aplicadas
- DB de test local: Docker `of-test-pg` en `localhost:5543`, credenciales en `backend/.env.test`
- Frontend: `output: 'export'` (estático, sin servidor). Login real ya funciona, `lib/auth.ts` + `lib/api.ts` + `lib/auth-context.tsx` + `components/RouteGuard.tsx` existen y están probados
- Roles: ADMIN, OPERADOR, CADETE

## FASE 3 — Conectar el store a la API real

Archivo central: `frontend/lib/caja-store.tsx` (695 líneas).

1. Borrar `CLIENTES`, `PARES`, `TRADERS`, `seedOps()` — todos los datos demo.
2. Poblar `state` desde `GET /operations`, `GET /customers`, `GET /quotations` (lo creás en Fase 6).
3. Convertir las acciones del reducer en llamadas a la API + refresco de estado.
4. **Todos los campos monetarios pasan a `string`** en las interfaces (`Operation.monto`, `cotiz`, `contra`, `Pata.monto`). Conversión a número **sólo** en el formateo para mostrar.
5. Reemplazar los selectores de KPI (`kpisPar`, `kpisOperador`) por `GET /operations/kpis/par` y `/operations/kpis/operador`. **Cero aritmética financiera en el frontend.**

**Regla dura:** mantené el contrato externo del store `{state, dispatch}` para no tocar las 11 páginas ya diseñadas. Cambiá el interior, no la interfaz.

### Criterios de aceptación Fase 3 (verificar CORRIENDO, no leyendo)

- Crear una operación en la UI, **recargar con F5**, y que siga ahí.
- La operación creada aparece en la base: `SELECT * FROM operacion ORDER BY "createdAt" DESC LIMIT 1`.
- `grep -rn 'Carlos Méndez\|Ana Rodríguez\|seedOps' frontend/` → **vacío**.
- Un monto grande (`1234567.89`) se muestra **exacto**, sin centavos perdidos.
- Los KPIs de la UI coinciden **dígito por dígito** con la respuesta de `/operations/kpis/par`.

## FASE 6 — Cotizaciones

`app/admin/quotation/` ya existe en la UI. El módulo backend `quotations` está vacío (`@Module({})`).

**Alcance mínimo, nada más:**
- `GET /quotations` — pares con compra/venta. El schema ya tiene `model Par`.
- `PUT /quotations/:par` — `@Roles(ADMIN, OPERADOR)`.

**Fuera de alcance:** histórico, cotizaciones automáticas, feeds externos.

### Criterios de aceptación Fase 6

- Cambiar una cotización en la UI, recargar, y que persista.
- Verificar la fila en la tabla `par`.
- Un CADETE haciendo `PUT /quotations/:par` → **403**.

## Reglas

1. **Tests obligatorios**: agregá tests de integración para los endpoints nuevos de `quotations`. La suite completa (`npx vitest run` en `backend/`) tiene que quedar en verde — hoy son 84.
2. **Verificá corriendo cosas reales**: levantá el backend contra la DB de test y `next dev` contra ese backend. Los criterios de arriba se comprueban con un browser y con SQL, no leyendo el código.
3. **Cero aritmética de dinero en el frontend.** Si un número sale de una cuenta, la cuenta la hace el backend.
4. **Prohibido `dangerouslySetInnerHTML`** (riesgo XSS con el token en localStorage).
5. **No toques `localStorage`** fuera de `lib/auth.ts`.
6. **No deployes nada.** Yo me encargo del deploy y de la verificación final.
7. Si algo del plan resulta equivocado al implementarlo, **paralo y reportá** en vez de improvisar una solución que contradiga el plan.
8. Si encontrás un bug fuera de alcance, reportalo explícitamente en vez de absorberlo en silencio.

## Entregable

Reporte final con: commits (hash + qué hace), resultado de `npx vitest run`, y cada criterio de aceptación con la evidencia real de cómo lo verificaste (comando corrido + output, no "debería funcionar").
