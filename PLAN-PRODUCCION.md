# PLAN DE PRODUCCIÓN — Oficina Fusion

> **Objetivo del dueño (textual):** *"Todo el sistema debe estar en funcionamiento real. Para ello tiene que haber inicio de sesión, distintas cuentas y los roles necesarios."*

**Autor:** @arquitecto · **Ejecuta:** @carlos · **Canal:** vía @hermes
**Estado del repo al planificar:** commit `19e71cf`

---

## 0. Resumen ejecutivo

El backend funciona y está en producción. El frontend es una **maqueta sin una sola llamada HTTP**. El trabajo es, en 80%, conectar una UI ya diseñada a una API ya existente — más el login que hoy no existe.

**Riesgo que define la prioridad de todo el plan:** hoy `/admin/closing` es accesible sin autenticar. Cualquiera con el link opera el cierre diario. **Nada se publica hasta que termine la Fase 2.**

### Hallazgos nuevos de este relevamiento

Cuatro cosas que no estaban en el brief y cambian el alcance:

| # | Hallazgo | Impacto |
|---|---|---|
| H1 | **El lockout YA está implementado** (`auth.service.ts:38-57`): 5 intentos → 30 min. Y `LoginEvent` **se escribe** (`:163-177`) | El punto 5 del brief es más chico de lo que parecía |
| H2 | **Bug: `login()` no verifica `user.activo`** (`:26-36`) | Desactivar un usuario **no lo echa**. `refreshToken` sí lo valida (`:130`), `login` no. Un empleado despedido sigue entrando |
| H3 | **Bug: el token no expira en la práctica.** `JWT_EXPIRES_IN` default `'7d'` en `auth.module.ts:18`, pero `users.module.ts:12` lo **hardcodea a `'7d'`** ignorando la env var | No se puede acortar la sesión sin tocar código |
| H4 | **El store del frontend usa `number` para dinero** (`caja-store.tsx:177-179`: `monto`, `cotiz`, `contra`) | Viola la regla dura *"Decimal como texto, nunca float"*. El backend manda strings; si el frontend hace `Number(...)`, un monto grande pierde centavos |

H2 y H3 son de seguridad y entran en la Fase 1. H4 define el contrato de la Fase 3.

---

## 1. Las 7 decisiones

### D1 — Se queda en `output: 'export'`. Guard client-side.

**Decisión:** no se cambia a SSR.

**Por qué:**
- La seguridad real ya la impone el backend: **cada endpoint tiene `JwtAuthGuard`** y los sensibles `@Roles(ADMIN)`. Un guard SSR no agregaría ni una garantía — sólo escondería el HTML de una página que sin token no puede traer datos.
- Cambiar a SSR obliga a un servidor Node en Netlify, cambia el deploy y agrega superficie de ataque y costo. El presupuesto es de **$5/mes**.
- El guard client-side resuelve el problema real: que no se vea la UI del cierre a quien no corresponde.

**Lo que hay que aceptar explícitamente:** el bundle JS de `/admin/*` es descargable por cualquiera. **No es una fuga** si y sólo si se cumple la regla: **cero secretos y cero lógica de negocio en el cliente** — el frontend pinta lo que el backend le da.

**Contrapartida a implementar:** el guard client-side muestra un flash de contenido antes de redirigir. Se resuelve con un estado `loading` que renderiza un skeleton hasta resolver la sesión, nunca la página.

---

### D2 — JWT en `localStorage`. Con mitigación explícita.

**Decisión:** `localStorage`, no cookie `httpOnly`.

**Por qué:** la cookie `httpOnly` es estrictamente mejor **contra XSS**, pero acá no es viable sin costo alto:
- Frontend en Netlify y backend en `fly.dev` son **dominios distintos** → la cookie es cross-site → requiere `SameSite=None; Secure`, que Safari y los bloqueadores tratan cada vez peor.
- Requeriría dominio propio con subdominios compartidos: más setup y más plata.
- Con `output: 'export'` no hay servidor Next que actúe de proxy same-origin.

**Mitigaciones obligatorias (no opcionales):**
1. **Cero `dangerouslySetInnerHTML`** en todo el frontend. Es la vía de XSS que convierte esta decisión en una brecha.
2. **Token de vida corta:** `JWT_EXPIRES_IN=8h` — una jornada. Requiere arreglar H3 primero.
3. El token se lee **sólo** desde el módulo `lib/auth.ts`. Ningún componente accede a `localStorage` directo.
4. Logout borra el token **antes** de llamar al backend, para que un fallo de red no deje la sesión viva.

> **Revisar si en algún momento hay dominio propio.** Con `app.oficina.com` + `api.oficina.com`, la cookie `httpOnly` pasa a ser viable y es la opción correcta. Queda anotado, no en el alcance.

---

### D3 — Sí, hace falta un tercer rol: `OPERADOR`.

**Decisión:** el enum pasa a `ADMIN | OPERADOR | CADETE`.

**Por qué:** con sólo ADMIN y CADETE, **todo el que carga operaciones puede confirmar el cierre diario**. En una oficina que maneja plata real eso rompe la separación de funciones más básica: quien opera no debe ser quien cierra y audita. Es exactamente el control que justifica el arqueo.

| Rol | Puede | No puede |
|---|---|---|
| `ADMIN` | todo | — |
| `OPERADOR` | cargar/editar/finalizar operaciones, ver clientes, crear e-tickets, ver cotizaciones, **armar el cierre en borrador** | **confirmar o reabrir el cierre**, crear/editar clientes, ajustar saldos, gestionar usuarios |
| `CADETE` | ver y confirmar **sus** e-tickets | **todo dato económico** (regla inamovible de mesa-demo) |

**Lo que implica:**
- Migración Prisma: agregar el valor al enum (`ALTER TYPE ... ADD VALUE`). **No destructiva**, los usuarios existentes no cambian.
- **`closing` NO se toca en su confirmación: `confirm` y `reopen` siguen sólo ADMIN.** Los `GET` y `POST /closing` sí se abren a OPERADOR (default 3, §6).
- Nota: hoy casi todo `operations` está en `auth` (cualquier rol autenticado) — eso hay que **cerrar**, porque hoy un CADETE puede crear operaciones. Ver Fase 2.

---

### D4 — Pantalla de gestión de usuarios: entra en el alcance.

Sin ella, crear una cuenta exige que alguien haga un `curl` con un token de admin. Una oficina no funciona así.

Alcance mínimo: listar, crear, activar/desactivar, resetear contraseña (con `primerLogin=true`), asignar roles.

Lo que hay que agregar al backend (hoy no existe): `PATCH /users/:id` (activo + roles) y `POST /users/:id/reset-password`.

---

### D5 — Seguridad: casi todo está hecho. Falta poco y es barato.

| Ítem | Estado real | Decisión |
|---|---|---|
| Lockout por intentos | **YA implementado** (5 → 30 min) | Nada que hacer. Exponer el mensaje en la UI |
| `LoginEvent` | **YA se escribe** | Agregarle IP y user-agent (hoy `:169` los descarta) |
| `login()` ignora `activo` | **BUG (H2)** | **Fase 1.** Un usuario desactivado debe recibir 401 |
| `JWT_EXPIRES_IN` ignorado | **BUG (H3)** | **Fase 1.** Sin esto no se puede acortar la sesión |
| `primerLogin` forzado | Campo existe, nadie lo usa | **Entra.** Es lo que evita que las cuentas nuevas queden con la contraseña que puso el admin |
| `AuditEvent` | Tabla vacía | **Sólo para cierre y ajuste de saldo.** Auditar todo es alcance que no se pidió |
| `model Sesion` | Existe, el auth es JWT stateless | **No se usa.** Dejarla vacía. Implementar sesiones server-side contradice D2 y no agrega nada hoy |
| Rate limiting global | No hay | **Fuera de alcance.** El lockout por usuario ya cubre fuerza bruta sobre una cuenta |

---

### D6 — Store: se mantiene el shape, se reemplazan las tripas.

**Decisión:** conservar el contrato `{ state, dispatch }` y los selectores (`useCaja`, `kpisPar`, etc.), y reemplazar el `useState` interno por data real. **No se reescriben las 11 páginas.**

**Por qué:** `caja-store.tsx:539` expone `{state, dispatch}` y las páginas consumen selectores. Si se preserva esa superficie, las páginas **no se tocan**. Reescribir a React Query en cada página es el camino que rompe la UI ya hecha.

**Cómo:**
- `state` se llena desde la API en vez del `seedOps()` hardcodeado.
- Cada `action` del reducer que hoy sólo muta memoria pasa a llamar al endpoint y refrescar. El dispatch se vuelve `async` por dentro; la firma que ven las páginas no cambia.
- **`CLIENTES`, `PARES`, `TRADERS` y `seedOps()` se borran.** Son datos inventados; si sobreviven, en algún render aparecen "Carlos Méndez" y un CBU falso en producción.
- Se agrega SWR **sólo** para revalidación y cache, por debajo del context.

**Sobre H4 (dinero como `number`):** el backend manda decimales **como texto**. El contrato es:
- Los campos monetarios viajan y se guardan en el state **como `string`**.
- Se convierten a número **únicamente** para formatear en pantalla.
- **Ningún cálculo financiero en el frontend.** Los KPIs y el cierre los calcula el backend (que ya tiene `decimal.ts` con precisión 30 y HALF_EVEN). Los selectores `kpisPar`/`kpisOperador` del store se reemplazan por `GET /operations/kpis/*`.

Esto último es lo que evita repetir el bug que ya costó caro en este proyecto: **dos implementaciones de la misma fórmula divergen siempre**.

---

### D7 — Backups: sí, entran. Es lo más barato del plan.

El Postgres es unmanaged, sin backups. Si se pierde el volumen, se pierde la contabilidad de la oficina.

**Decisión:** cron diario con `pg_dump` comprimido, retención 14 días, **fuera de Fly** (un backup en la misma infra que la base no protege de perder la cuenta). Destino: la máquina de Nicolás o un bucket.

**Costo: $0.** No entra en el presupuesto de $5.

**Criterio de aceptación:** no alcanza con que el dump exista. **Hay que restaurarlo** en una base limpia y verificar que las tablas tienen las filas esperadas. Un backup no verificado no es un backup.

---

## 2. Alcance: qué NO hacer

Para que no haya deriva:

- **NO** implementar los módulos `tramites`, `agenda`, `expenses`. Están vacíos y **no tienen UI** que los consuma. Fuera del mínimo.
- **NO** implementar `quotations` como CRUD completo. La UI `app/admin/quotation/` existe, así que entra — pero **sólo lectura/edición de cotizaciones del par**, que es lo que la página necesita. Ver Fase 6.
- **NO** implementar el Service 13 (pago de cheques posados). Regla dura: **nunca**.
- **NO** tocar `model Sesion` ni migrar a sesiones server-side.
- **NO** implementar rate limiting global, 2FA, ni refresh tokens rotativos.
- **NO** rediseñar la UI. Está hecha y aprobada; se conecta, no se rehace.
- **NO** reescribir las 11 páginas del frontend (ver D6).
- **NO** migrar a Managed Postgres ($38/mes contra un presupuesto de $5).
- **NO** publicar la URL del frontend hasta que la Fase 2 esté verificada.

---

## 3. Fases

Orden por dependencia. Cada fase cierra con criterios **verificables por ejecución**, no por inspección.

---

### FASE 1 — Arreglar los dos bugs de auth (bloqueante, chica)

**Por qué primero:** son de seguridad y el resto del plan se apoya en ellos. D2 depende de poder acortar el token.

**Archivos:**
- `backend/src/modules/auth/auth.service.ts:26-36`
- `backend/src/modules/auth/users.module.ts:12`

**Tareas:**

1. **`login()` debe rechazar usuarios inactivos.** Después de encontrar al usuario y **antes** de comparar la contraseña:
   ```
   si !user.activo -> logLoginEvent(user.id, false, 'Account inactive') + UnauthorizedException('Invalid credentials')
   ```
   Mensaje genérico a propósito: no revelar si la cuenta existe.

2. **`users.module.ts:12`** debe usar `process.env.JWT_EXPIRES_IN || '7d'`, igual que `auth.module.ts:18`. Hoy hardcodea `'7d'`.

3. Setear en Fly: `JWT_EXPIRES_IN=8h`.

4. `logLoginEvent` debe guardar **IP y user-agent**. Hoy `:169` los arma y los descarta. Requiere pasar el `Request` desde el controller.

**Criterios de aceptación:**
- Un usuario con `activo=false` que intenta login recibe **401**, no un token. Verificar contra la base: desactivar, intentar, leer la respuesta.
- Decodificar un token nuevo y verificar que `exp - iat ≈ 8h`.
- Un login fallido y uno exitoso dejan filas en `LoginEvent` **con IP y user-agent no nulos**.
- `pnpm --filter backend test` pasa.

---

### FASE 2 — Login real y cierre del agujero de permisos (bloqueante)

**Por qué:** es el pedido literal del dueño y lo que hoy hace que el sistema no pueda publicarse.

#### 2A — Backend: rol OPERADOR y permisos correctos

1. Migración: agregar `OPERADOR` al enum `RolUsuario`.
   ```sql
   ALTER TYPE "RolUsuario" ADD VALUE 'OPERADOR';
   ```
   **En una carpeta de migración nueva.** Nunca editar una ya aplicada ni aplicar SQL por `psql` directo: lo que no está en un archivo de migración, en la próxima máquina no existe.

2. **Cerrar el agujero de `operations` y `e-tickets`.** Hoy están en `auth` — cualquier rol autenticado, **incluido CADETE**, puede crear operaciones. Pasan a `@Roles(ADMIN, OPERADOR)`:
   - `POST /operations`, `PUT /operations/:id`, `POST /operations/:id/finalize`, `POST /operations/:id/cancel`
   - `POST /e-tickets`, `PUT /e-tickets/:id`
   - Los `GET` de `operations` quedan `@Roles(ADMIN, OPERADOR)` también: **un cadete no ve operaciones**.
   - `GET /e-tickets` y `POST /e-tickets/:id/confirm` siguen accesibles al cadete — pero filtrados (Fase 5).
   - **`closing` se parte** (default 3, ver §6): `POST /closing` y los `GET` pasan a `@Roles(ADMIN, OPERADOR)` para que el operador arme el borrador; **`confirm` y `reopen` siguen `@Roles(ADMIN)`**.

3. `POST /users/:id/reset-password` y `PATCH /users/:id` (activo, roles), ambos `@Roles(ADMIN)`.

4. `GET /auth/me` debe devolver `primerLogin`, para que el frontend sepa si forzar el cambio.

#### 2B — Frontend: login, sesión y guard

**Archivos nuevos:**
- `frontend/lib/api.ts` — cliente HTTP único. Lee `NEXT_PUBLIC_API_URL`, inyecta `Authorization: Bearer`, y **ante 401 borra el token y redirige a `/login`**.
- `frontend/lib/auth.ts` — el **único** módulo que toca `localStorage`. `getToken`, `setToken`, `clearToken`, `getUser`.
- `frontend/lib/auth-context.tsx` — `AuthProvider` con `{ user, loading, login, logout }`. Al montar, si hay token llama `GET /auth/me`; si falla, limpia y manda a login.
- `frontend/app/login/page.tsx` — usuario, contraseña, errores. Mensaje específico para cuenta bloqueada (el backend devuelve 403 con la fecha).
- `frontend/app/cambiar-password/page.tsx` — obligatorio cuando `primerLogin=true`.
- `frontend/components/RouteGuard.tsx` — envuelve los layouts. Mientras `loading`, **skeleton** (nunca la página). Sin sesión → `/login`. Con sesión y rol incorrecto → su home.

**Archivos a modificar:**
- `frontend/app/admin/layout.tsx` — **borrar el usuario hardcodeado** `{ name: 'Nicolás García', ... }` y tomarlo del context. Envolver en `RouteGuard` con `ADMIN`/`OPERADOR`.
- `frontend/app/cadete/layout.tsx` — `RouteGuard` con `CADETE` (+ADMIN).
- `frontend/app/page.tsx` — el selector de rol de la home deja de elegir rol: redirige según el rol **real** del token.

**Criterios de aceptación** (se verifican en un navegador real, con la pestaña de red abierta):
- Entrar a `/admin/closing` sin sesión → redirige a `/login` y **no** se ve un frame del cierre.
- Login con `admin` → entra al dashboard y `GET /auth/me` devuelve 200.
- Login con un usuario CADETE → entrar a mano a `/admin/closing` → redirigido, y si aun así llamara la API, **403**.
- Un usuario OPERADOR puede crear una operación (**201**) y recibe **403** al llamar `POST /closing/:id/confirm`.
- Borrar el token del `localStorage` y recargar → vuelve a `/login`.
- `grep -rn 'dangerouslySetInnerHTML' frontend/` → **vacío** (mitigación de D2).
- `grep -rn "localStorage" frontend/` → aparece **sólo** en `lib/auth.ts`.

---

### FASE 3 — Conectar el store a la API real

**Depende de:** Fase 2 (sin token no hay requests).

**Archivo:** `frontend/lib/caja-store.tsx` (695 líneas).

**Tareas:**
1. Borrar `CLIENTES`, `PARES`, `TRADERS`, `seedOps()`.
2. Poblar `state` desde `GET /operations`, `GET /customers`, y los pares (ver Fase 6).
3. Convertir las acciones del reducer en llamadas a la API + refresco.
4. **Todos los campos monetarios pasan a `string`** en las interfaces (`Operation.monto`, `cotiz`, `contra`, `Pata.monto`). Conversión a número **sólo** en el formateo.
5. Reemplazar los selectores de KPI (`kpisPar`, `kpisOperador`) por `GET /operations/kpis/par` y `/operador`. **Cero aritmética financiera en el frontend.**

**Criterios de aceptación:**
- Crear una operación en la UI, **recargar con F5**, y que siga ahí. (Hoy se pierde: es el síntoma central.)
- La operación creada aparece en la base: `SELECT * FROM operacion ORDER BY "createdAt" DESC LIMIT 1`.
- `grep -rn 'Carlos Méndez\|Ana Rodríguez\|seedOps' frontend/` → **vacío**.
- Un monto grande (ej. `1234567.89`) se muestra **exacto**, sin centavos perdidos.
- Los KPIs de la UI coinciden **dígito por dígito** con la respuesta de `/operations/kpis/par`.

---

### FASE 4 — Pantalla de gestión de usuarios

**Depende de:** Fase 2 (endpoints + guard).

**Archivo nuevo:** `frontend/app/admin/users/page.tsx`, con el `DataList` que ya existe.

Funciones: listar (con rol, activo, bloqueado), crear, activar/desactivar, resetear contraseña, cambiar roles.

**Criterios de aceptación:**
- Crear un usuario desde la UI, cerrar sesión, entrar con él → **funciona**, y lo primero que ve es la pantalla de cambio de contraseña (`primerLogin`).
- Desactivarlo y volver a intentar → **401** (esto valida la Fase 1 de punta a punta).
- Un OPERADOR que entra a `/admin/users` → redirigido.

**Usuarios semilla** (default 1, §6): 2 ADMIN, 1 OPERADOR, 2 CADETE.

Crearlos **desde la UI**, no con un script de seed: así el alta queda probada por el camino real que va a usar la oficina. Cada uno nace con `primerLogin=true` y su dueño elige la contraseña en el primer ingreso — **el admin nunca conoce la contraseña final de nadie**.

---

### FASE 5 — E-tickets y el filtro del cadete

**Depende de:** Fases 2 y 3.

**Regla inamovible:** el cadete **no ve datos económicos**.

**Backend:** `GET /e-tickets` con rol CADETE debe devolver **sólo sus e-tickets** y **sólo los campos no económicos** — usando `select` explícito, nunca `include`.

Campos que deben quedar afuera: `cliente.saldoUsd`, `cliente.puntosHabituales`, `operation.cotiz`, `operation.clientRate`, `operation.puntos`, `operation.contra`, `operation.comision`.

> **Por qué `select` y no `include`:** con `select`, agregar un campo al modelo **no** lo agrega a la respuesta. Con `include`, sí — y un `include` mal puesto compila perfecto.

**Criterio de aceptación — el más importante de esta fase:**
- Con un token de CADETE, pegarle a `GET /e-tickets` y verificar **sobre el JSON serializado** (no sobre el tipo de TypeScript) que ninguno de esos 7 campos aparece. `curl ... | grep -i 'saldoUsd\|cotiz\|comision'` → **vacío**.
- Un cadete pidiendo el e-ticket de otro cadete por ID → **403 o 404**, nunca el dato.

---

### FASE 6 — Cotizaciones (mínimo para que la UI funcione)

**Depende de:** Fase 3.

`app/admin/quotation/` existe y el módulo `quotations` está vacío (sólo `quotations.module.ts`).

**Alcance mínimo, nada más:** `GET /quotations` (pares con compra/venta) y `PUT /quotations/:par` (`@Roles(ADMIN, OPERADOR)`). El schema ya tiene `model Par`.

**Fuera de alcance:** histórico, cotizaciones automáticas, feeds externos.

**Criterios de aceptación:** cambiar una cotización en la UI, recargar, y que persista; verificar la fila en `par`.

---

### FASE 7 — Backups verificados

**Independiente:** puede ir en paralelo desde el principio.

Script `pg_dump` comprimido + cron diario + retención 14 días. Destino: **bucket S3 externo** (Backblaze B2 o MinIO), fuera de Fly — un backup en la misma infra que la base no protege de perder la cuenta.

**Restauración semanal en Postgres local (Docker), no en staging** — no existe entorno de staging y montarlo no entra en el presupuesto (ver §6).

**Criterio de aceptación:** restaurar un dump en una base limpia y verificar los conteos de `operacion`, `cliente` y `cierre` contra el origen. **Sin restauración probada, la fase no está hecha.**

**Ojo con las credenciales:** las claves del bucket van en secrets de Fly o en el entorno del cron, **nunca en el repo**. Y el bucket no debe ser público.

---

## 4. Orden y paralelismo

```
FASE 1 (bugs auth)  ──►  FASE 2 (login + permisos)  ──┬──►  FASE 3 (store)  ──┬──►  FASE 5 (e-tickets)
                                                       │                       └──►  FASE 6 (cotizaciones)
                                                       └──►  FASE 4 (usuarios)

FASE 7 (backups) ── independiente, en paralelo desde el día 1
```

**Hito de publicación:** la URL del frontend **no se comparte con nadie** hasta que la Fase 2 esté verificada con sus criterios. Antes de eso, el sistema está abierto.

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| El bundle de `/admin/*` es público (consecuencia de D1) | Cero secretos y cero lógica de negocio en el cliente. Auditar en cada fase |
| XSS roba el token de `localStorage` (consecuencia de D2) | Prohibido `dangerouslySetInnerHTML`; token de 8h; acceso sólo vía `lib/auth.ts` |
| Postgres sin backups | Fase 7, en paralelo desde el día 1 |
| Cálculo financiero duplicado front/back | Prohibido calcular en el frontend. Los KPIs vienen de la API |
| `auto_stop_machines = suspend` → primer request lento | Aceptado: es el costo de $3.35/mes. Mostrar un loading decente |
| Datos demo sobreviven a la migración | Criterio de aceptación explícito con `grep` en la Fase 3 |

---

## 6. Defaults confirmados (vía @hermes)

Los 4 UNKNOWNs quedaron resueltos con estos defaults, ajustables más adelante:

| # | Default |
|---|---|
| 1 | **Usuarios iniciales:** 2 ADMIN, 1 OPERADOR, 2 CADETE. Los 3 roles activos |
| 2 | **Cadete rotativo.** El sistema no hardcodea quién opera |
| 3 | **Sólo ADMIN confirma el cierre.** OPERADOR valida/propone. Separación estricta |
| 4 | **Backups a S3 externo** (B2/MinIO). Dump diario, retención 14 días, test de restauración semanal en staging |

### Dos de estos defaults cambian el alcance. Quedan explícitos:

#### El default 3 agrega trabajo a la Fase 2

*"OPERADOR valida/propone"* **no es lo que el plan decía**. El plan dejaba `closing` entero en `@Roles(ADMIN)`, o sea que un OPERADOR **no puede ni ver** el cierre — mucho menos proponerlo.

Para que un operador pueda validar o proponer hacen falta permisos partidos, no un rol excluido:

| Endpoint | Antes (plan original) | Con el default 3 |
|---|---|---|
| `POST /closing` (crear borrador) | ADMIN | **ADMIN, OPERADOR** |
| `GET /closing`, `GET /closing/:id` | ADMIN | **ADMIN, OPERADOR** |
| `POST /closing/:id/confirm` | ADMIN | **ADMIN** — sin cambio |
| `POST /closing/:id/reopen` | ADMIN | **ADMIN** — sin cambio |

Así el operador arma el cierre y lo deja en borrador; el admin es el único que lo confirma. **La separación de funciones se mantiene intacta** y de hecho mejora: el que cuenta la caja no es el que la aprueba.

**Criterio de aceptación adicional para la Fase 2:**
- Un OPERADOR llama `POST /closing` → **201**.
- El mismo OPERADOR llama `POST /closing/:id/confirm` → **403**.
- El mismo OPERADOR llama `POST /closing/:id/reopen` → **403**.

#### El default 4 menciona un staging que no existe

*"test de restauración semanal en staging"* — **no hay entorno de staging**, y montarlo son otra app de Fly y otra base, contra un presupuesto de $5.

**Propuesta:** la restauración semanal se hace en un **Postgres local en Docker**, no en un staging remoto. Verifica exactamente lo mismo — que el dump se restaura y los conteos coinciden — a costo cero. Es el mismo método ya usado en este proyecto para validar migraciones: base descartable, clonar, probar, borrar.

Si Nicolás quiere un staging real, es una decisión de presupuesto aparte y no bloquea la Fase 7.

---

## 7. UNKNOWNs restantes

Ninguno bloqueante. Los cuatro originales quedaron resueltos arriba.

Queda una pregunta abierta de menor prioridad, heredada del trabajo previo sobre el motor de cierre:

- **P&L no realizado:** ninguna de las fórmulas de `openUsd` valúa la posición abierta contra el precio de mercado del cierre. No afecta a este plan (es del motor de cierre, no de auth), pero conviene resolverlo antes de que la oficina use los números para decidir.

