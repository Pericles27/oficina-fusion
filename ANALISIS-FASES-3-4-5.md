# Análisis Fases 3, 4 y 5 — respuesta a las 3 preguntas

**Autor:** @arquitecto · **Para:** @carlos vía @hermes
**Método:** todo lo que sigue está verificado leyendo el código actual, con cita `archivo:línea`.

---

## 0. Antes que nada: dos afirmaciones del brief que no se sostienen

### B1 — "e-tickets ya tiene GET y GET/:id con vista reducida para cadete"

**Falso para `GET`.** Verificado:

| Endpoint | Vista reducida |
|---|---|
| `GET /e-tickets/:id` | **Sí** — `e-tickets.controller.ts:59-61` detecta CADETE y llama `findOneForCadete` |
| `GET /e-tickets` | **NO** — `controller.ts:41-54` no mira el rol. `service.ts:61-66` hace un `findMany` **sin `select`** |

O sea: el detalle está protegido y **el listado devuelve todo**. Un cadete que llama `GET /e-tickets` recibe `montoEntregar`, `montoRecibir` y las dos monedas de **todos** los e-tickets de la oficina.

Y hay un tercer agujero que el brief no menciona: **`findOneForCadete` protege el e-ticket pero no bloquea el de otro cadete.** `service.ts:80-84` filtra campos, no dueños. Cualquier cadete puede leer el e-ticket de cualquier otro poniendo el ID.

### B2 — "agregar cadeteId como query param"

**No se puede: el campo no existe.** `grep -n 'cadete\|asignado' schema.prisma` sobre el modelo `Eticket` (líneas 674-718) devuelve sólo un comentario. El modelo tiene `creadoPor` y `confirmadoPor` — ningún campo de cadete asignado.

`model Tramite` sí tiene `asignadoA` (`schema.prisma:741`). `Eticket` no.

**Consecuencia:** "filtrar los e-tickets del cadete logueado" **no es un query param, es una decisión de modelo de datos** que todavía no está tomada. Ver pregunta 2.

---

## 1. Store: cómo mantener `{state, dispatch}` con una API async

### La respuesta corta

`useEffect` para la carga inicial + **`dispatch` async por dentro con la firma sincrónica intacta** + SWR sólo como cache/revalidación por debajo. **No** React Query dentro del context: duplica la máquina de estado que el reducer ya es.

### Por qué el dispatch puede volverse async sin romper nada

`caja-store.tsx:334` declara `dispatch: (action: any) => void`. **Devuelve `void`.** Ninguna página puede estar esperando un valor de retorno — TypeScript no se lo permitiría. Entonces el interior puede hacer `await` libremente: la firma pública no cambia.

```ts
// El contrato que ven las 11 páginas NO cambia:
interface CajaContextType {
  state: CajaState;
  dispatch: (action: any) => void;   // sigue devolviendo void
  // agregados, opcionales de consumir:
  loading: boolean;
  error: string | null;
}
```

### El patrón concreto

```ts
export function CajaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CajaState>(EMPTY_STATE);   // ya NO seedOps()
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Carga inicial
  useEffect(() => {
    let cancelado = false;                      // evita setState tras unmount
    (async () => {
      try {
        const [ops, clientes, pares] = await Promise.all([
          api.get('/operations'),
          api.get('/customers'),
          api.get('/quotations'),
        ]);
        if (cancelado) return;
        setState({ diaAbierto: true, operaciones: ops.data, clientes, pares, traders: [], lastOperadorId: null });
      } catch (e) {
        if (!cancelado) setError(mensajeDe(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // 2. dispatch: firma sincrónica, cuerpo async
  const dispatch = useCallback((action: any) => {
    void (async () => {
      try {
        switch (action.type) {
          case 'ADD_OP':
            await api.post('/operations', action.payload);
            await refetchOperaciones();        // la verdad vuelve del servidor
            break;
          case 'PATCH_OP':
            await api.put(`/operations/${action.id}`, action.patch);
            await refetchOperaciones();
            break;
          // ...
        }
      } catch (e) {
        setError(mensajeDe(e));                // nunca swallow
      }
    })();
  }, []);
}
```

### Las tres trampas de este archivo, verificadas

#### T1 — `caja-store.tsx:360` calcula dinero en el cliente

```ts
const contra = p.monto * p.cotiz;      // ← float, en el navegador
```

El backend hace lo mismo pero bien (`operations.service.ts:27`): `monto.times(cotiz)` con Decimal, y lo guarda con `toFixed(4)`.

**Regla:** ese cálculo **se borra**. `contra` llega del `POST /operations`. Si el frontend lo calcula y el backend también, divergen — ya pasó en este proyecto con las fórmulas de `openUsd` (11% de diferencia) y con el spread.

#### T2 — `caja-store.tsx:367` genera el código secuencial en el cliente

```ts
codigo: `OP-${String(prev.operaciones.length + 1).padStart(4, '0')}`
```

El backend genera el mismo formato desde la base (`operations.service.ts:12-19`, `MAX(numero) + 1`), y `Operacion.codigo` es **`@unique`**.

**Esto es un bug de concurrencia real:** dos operadores con 40 operaciones cargadas en pantalla generan los dos `OP-0041`. El segundo recibe un error de clave duplicada. Y si la lista del cliente está desactualizada, el número no tiene ninguna relación con la realidad.

**Regla:** el `codigo`, el `numero` y el `id` los asigna **siempre** el backend. El frontend nunca inventa identificadores.

#### T3 — Optimistic update: no lo usen en esta fase

Es tentador pintar la operación antes de la respuesta. **No conviene acá** porque `id`, `codigo` y `contra` los decide el servidor: habría que crear una fila fantasma y después reconciliarla.

**Decisión: `await` y después refetch.** Más simple y sin estados imposibles. La UI muestra un spinner en el botón. Si más adelante molesta la latencia, se revisa — pero con datos, no por anticipado.

### Dinero como `string`: el punto que define la fase

El backend ya manda strings (`operations.service.ts:158-160`: `o.monto.toString()`).

```ts
export interface Operation {
  monto: string;      // era number
  cotiz: string;      // era number
  contra: string;     // era number
}
```

- `Number(...)` **sólo** dentro del formateador de pantalla.
- **Cero aritmética financiera en el frontend.** Los KPIs vienen de `GET /operations/kpis/par` y `/operador`.
- Los selectores `kpisPar`/`kpisOperador` (`caja-store.tsx:573-578`) **se borran**, no se adaptan: hoy hacen `reduce((s,o) => s + o.contra, 0)` sobre floats.

**Criterio de aceptación:** cargar `1234567.89`, y que la UI muestre exactamente eso. Y que los KPIs de pantalla coincidan **dígito por dígito** con la respuesta de la API.

---

## 2. Cadete: ni query param ni endpoint propio. Falta decidir el modelo.

### El problema real

El brief pide `GET /e-tickets?cadeteId=${user.id}`. **Dos cosas andan mal con eso:**

1. **El campo no existe** (ver B2). No hay a qué filtrar.
2. **Un `cadeteId` que viene del cliente no es seguridad.** Si el filtro es un query param, un cadete pone el ID de otro y ve sus e-tickets. El servidor **nunca** debe confiar en el cliente para decidir qué puede ver.

> Regla general: **el alcance de lo que un usuario ve se deriva del token, no de un parámetro.**

### La decisión de modelo (hace falta antes de codear)

¿Qué significa "los e-tickets del cadete"?

| Opción | Semántica | Requiere |
|---|---|---|
| **A** | Los que **él confirmó** (`confirmadoPor`) | Nada nuevo. Pero sólo sirve *después* de entregar: no le muestra lo pendiente. **Inútil para operar** |
| **B** | Los que le fueron **asignados** | Campo nuevo `asignadoA` + migración + UI de asignación |
| **C** | **Todos los pendientes** — bolsa común, el primero que agarra entrega | Nada nuevo |

**Mi recomendación: C para el alcance mínimo, con B como evolución.**

Por qué: un cadete en una oficina chica entrega lo que haya. El modelo de asignación supone un despachador que asigna, y eso es flujo de trabajo que nadie pidió todavía. Con C, la Fase 5 **no necesita migración** y queda andando hoy.

Pero **C es una decisión de negocio, no técnica**, y no la tomo yo. Si en la oficina cada cadete tiene su zona o su cliente, C está mal y hace falta B.

**Pregunta para Nicolás:** *¿los cadetes agarran cualquier entrega pendiente, o cada uno tiene asignadas las suyas?*

Mientras no haya respuesta, implementar **C**: es la que menos supone y no bloquea.

### La implementación, cualquiera sea la opción

El filtro va **en el servidor, derivado del token**:

```ts
// controller
@Get()
findAll(@Req() req, @Query('estado') estado?: string, ...) {
  const esCadete = req.user.roles.includes(RolUsuario.CADETE)
                && !req.user.roles.includes(RolUsuario.ADMIN);
  return this.eTicketsService.findAll({
    estado, clienteId, page, pageSize,
    scopeCadeteId: esCadete ? req.user.id : undefined,   // del TOKEN
  });
}
```

```ts
// service — opción C
if (params.scopeCadeteId) {
  where.estado = 'pendiente';     // ignora el filtro de estado que venga del cliente
}

// y SIEMPRE, para cadete, select explícito:
const CADETE_SELECT = {
  id: true, numero: true, codigo: true, ts: true, estado: true,
  metodoEntrega: true, direccionEntrega: true, telefonoContacto: true,
  nombreRecibe: true, horarioEntrega: true, banco: true,
  cuentaDeposito: true, instrucciones: true,
  monedaEntregar: true, montoEntregar: true,   // ver nota abajo
} as const;
```

### `select`, no destructuring

`findOneForCadete` (`service.ts:80-84`) usa destructuring para quitar campos:

```ts
const { montoEntregar, montoRecibir, monedaEntregar, monedaRecibir, ...safe } = et;
```

**Esto es frágil.** Si mañana alguien agrega `comisionUsd` al modelo, aparece en `safe` **automáticamente** y el código compila perfecto. Es exactamente el patrón que produce fugas silenciosas.

**Con `select` explícito, un campo nuevo no se filtra solo** — hay que agregarlo a mano. Es la diferencia entre una lista blanca y una lista negra, y en datos sensibles siempre va lista blanca.

### Una contradicción que hay que resolver

El schema dice `// Montos para el cadete (cuánto entregar, cuánto recibir)` (`schema.prisma:698`), pero `findOneForCadete` **los elimina**.

Las dos cosas no pueden ser ciertas. Y tiene sentido práctico que el cadete sepa cuánto entrega — si no, no puede hacer la entrega.

**Mi lectura:** la regla inamovible es *"el cadete no ve datos económicos"* en el sentido de **cotización, comisión, spread, saldo del cliente** — el negocio. El monto que tiene que entregar es **instrucción operativa**, no información de negocio.

**Pregunta para Nicolás:** *¿el cadete ve el monto que entrega?* Si no lo ve, no puede verificar que le dieron bien la plata; si lo ve, sabe cuánto dinero lleva encima.

Mientras no haya respuesta: **mantener el comportamiento actual** (no mostrarlo) por ser el más conservador, y dejarlo en una constante de un solo lugar para cambiarlo con una línea.

### Criterios de aceptación de la Fase 5

Se verifican **sobre el JSON serializado**, no sobre el tipo de TypeScript:

1. `curl -H 'Bearer <token-cadete>' .../e-tickets | grep -iE 'saldoUsd|cotiz|comision|clientRate|puntos'` → **vacío**.
2. Un cadete pide por ID el e-ticket de otro cadete → **403 o 404**, nunca el dato.
3. Un cadete pasa `?cadeteId=<otro>` a mano → el parámetro **se ignora**, no cambia el resultado.
4. El mismo endpoint con token ADMIN **sí** devuelve los campos económicos.

El 3 es el que prueba que el alcance se deriva del token.

---

## 3. Riesgos que el plan de producción no menciona

### R1 — El `GET /e-tickets` sin filtro es una fuga activa (CRÍTICO)

No es un riesgo futuro: está pasando. Con la Fase 2 terminada ya hay cadetes con token válido, y el listado les devuelve los montos de toda la oficina.

**El plan lo daba por cubierto y no lo está.** Es lo primero de la Fase 5.

### R2 — Generación de códigos en el cliente (ALTO)

Ver T2. `codigo` es `@unique` y el frontend lo calcula desde `length + 1`. Dos operadores simultáneos colisionan. Hoy no explota porque nada se persiste; **al conectar la API, explota**.

Detalle adicional: `nextCodigo()` del backend (`operations.service.ts:12-19`) hace `MAX(numero) + 1` **sin lock**. Dos requests concurrentes pueden leer el mismo máximo. Es poco probable en una oficina chica, pero es el tipo de bug que aparece justo en el día de más trabajo. Anotado — no bloquea la Fase 3.

### R3 — `operations.service.ts:83` usa `include`, no `select` (ALTO)

```ts
include: { par: true, cliente: true, comision: true }
```

`cliente: true` arrastra **`saldoUsd`** y **`puntosHabituales`**. Hoy sólo lo alcanzan ADMIN y OPERADOR, así que no es fuga. **Pero** si en algún momento se le da a un cadete cualquier endpoint que devuelva una operación, la fuga aparece sin que nadie toque esa línea.

Mismo patrón que B1. Conviene pasarlo a `select` mientras se está en el código.

### R4 — El estado del día (`diaAbierto`) no existe en el backend (MEDIO)

`caja-store.tsx:341` arranca con `diaAbierto: true` y hay acciones `ABRIR_DIA`/`CERRAR_DIA`. **No hay endpoint ni campo** que persista eso.

Al recargar, el día siempre aparece abierto. Si la UI usa ese flag para habilitar la carga de operaciones, un F5 reabre un día cerrado.

**Para la Fase 3:** derivarlo del cierre del día (`GET /closing` del día actual) en vez de mantenerlo en memoria. Si no se puede, dejarlo documentado como limitación conocida — pero no inventar un endpoint que nadie pidió.

### R5 — `traders` no tiene fuente (MEDIO)

`TRADERS` es dato hardcodeado (`caja-store.tsx:345`) y los selectores `traderById` (`:644`) lo consumen. Al borrarlo, la UI que muestre el nombre del operador queda vacía.

La fuente natural es `GET /users`, pero es **`@Roles(ADMIN)`** — un OPERADOR no puede listarla. Dos salidas:
- **(a)** `GET /operations` ya trae `operadorId`; agregar el nombre al response del backend. **Recomendada:** no abre permisos.
- **(b)** Endpoint `GET /users/operadores` con nombre e iniciales, sin datos sensibles.

Elegir **(a)**: menos superficie.

### R6 — El 401 global puede patear al usuario en medio de la carga (MEDIO)

El plan define que ante 401 se borra el token y se redirige. Con el token de 8h de D2, **la sesión va a expirar en medio de la jornada**. Si expira mientras se completa una operación, el operador pierde lo que estaba cargando.

**Mitigación mínima:** antes de redirigir por 401, no descartar en silencio — avisar que la sesión expiró. Un `POST` que falla por 401 debe decirlo, no desaparecer.

`/auth/refresh` ya existe en el service (`auth.service.ts:125-135`) y **no está expuesto en el controller**. Exponerlo y renovar el token cuando quedan menos de 30 min es una mejora chica y de mucho valor. **Fuera del alcance mínimo**, pero vale anotarlo.

### R7 — La Fase 4 está "casi lista" sin verificar (MEDIO)

El brief dice que `app/admin/users/page.tsx` ya existe y llama a la API real. **No lo verifiqué** — no estaba entre lo que me pidieron analizar.

Lo que sí digo: el criterio de aceptación de la Fase 4 **no es que la pantalla cargue**. Es el ciclo completo: crear usuario → entrar con él → cambio de contraseña forzado → desactivarlo → **401 al reintentar**. Ese último paso es el que valida el arreglo de H2 de punta a punta, y es el que se suele saltear.

---

## 4. Orden recomendado

```
1. Fase 5 — backend (R1, fuga activa)     ← PRIMERO, es seguridad
2. Fase 3 — store                          ← el grueso
3. Fase 5 — frontend cadete
4. Fase 4 — verificación del ciclo completo
```

La fuga del listado va primero aunque la Fase 5 figure después: ya hay cadetes con token.

**Fuera de alcance, confirmado:** `/cadete/tickets/new` sigue hardcodeada. Correcto dejarla — crear e-tickets es `@Roles(ADMIN, OPERADOR)` (`e-tickets.controller.ts:66`), así que esa página **no debería existir del lado del cadete**. Vale revisar si tiene sentido, más que conectarla.

---

## 5. Decisiones que necesito de Nicolás

Ninguna bloquea el arranque. Las dos primeras bloquean el **cierre** de la Fase 5:

1. **¿Los cadetes agarran cualquier entrega pendiente, o cada uno tiene las suyas asignadas?** Define si hace falta el campo `asignadoA` y una migración. Mientras tanto: bolsa común (opción C).
2. **¿El cadete ve el monto que tiene que entregar?** El schema dice que sí (`:698`), el código dice que no (`:82`). Mientras tanto: no lo ve (lo más conservador).
3. **¿El día se abre y cierra de verdad, o `diaAbierto` era de la maqueta?** (R4)
