# Oficina Fusion — Observaciones de Demo (15/Oct/2026)

_Recopila bugs, errores, UX issues y cambios observados durante la revisión._

| # | Perfil | Fecha/Hora | Archivo/Sección | Tipo | Descripción |
|---|--------|-----------|----------------|------|-------------|
|   |        |           |                |      |             |
| 1 | Nicolás | 15/Oct/2026 | Nueva Operación | Bug | Al cargar una nueva operación, no se carga/visualiza el nombre del cliente. |
| 2 | Nicolás | 15/Oct/2026 | eTicket (Admin) | UX | eTicket muestra campos de dirección por separado para ambos lados de la operación (emisor/receptor). Demasiado complejo: debe existir UNA sola dirección por operación. Si no es depósito bancario, se aplica una única dirección de transporte; si es depósito bancario, la dirección de envío no aplica. |
| 3 | Nicolás | 15/Oct/2026 | Clientes — Agregar | Bug | El botón "Agregar nuevo cliente" no despliega el formulario de creación. |
| 4 | Nicolás | 15/Oct/2026 | Clientes — Edición | UX | El detalle de cliente debe permitir cargar dirección completa y cuentas bancarias (alias CBU/CUIT). No se puede hacer esta carga desde la UI. |
| 5 | Nicolás | 15/Oct/2026 | eTicket (Cadete) | Bug/UX | Si la operación es un depósito, el eTicket para el cadete debe mostrar SIEMPRE los datos completos del depósito (beneficiario, alias, CBU, monto). Prioridad: número de cuenta y tipo de cuenta son los campos más importantes y deben destacarse. |
| 6 | Nicolás | 15/Oct/2026 | Dashboard/Operaciones | Bug | La ganancia no se calcula correctamente. Cargó operaciones de simulación con ganancia en USD y el resultado aparece en 0. |
| 7 | Nicolás | 15/Oct/2026 | Multi-moneda | Regla de negocio | USD es la única moneda de referencia. Todas las demás monedas se cotizan a través de USD como intermediario (ej: ARS → USD → BRL). No hay paridad directa ARS-EUR, ARS-BRL, etc. |
| 8 | Nicolás | 15/Oct/2026 | Diseño/UI | Mejora estética | Estilos actuales no terminan de cerrar. Busca un estilo más limpio, tipo Apple. Requiere modo claro y modo oscuro. Abierto a pruebas experimentales de diseño antes de implementar. |
| 9 | Nicolás | 24/Oct/2026 | Dashboard / Mesa de Operaciones | UX | El dashboard y la mesa de operaciones muestran la misma información; es redundante. El dashboard debe mostrar datos más generales: ganancias, cantidad de operaciones pendientes, etc. El detalle de operaciones queda en la mesa. |
| 10 | Nicolás | 24/Oct/2026 | Clientes — Modal de carga | Bug/UX | El modal de carga de clientes aparece muy arriba en la pantalla y queda cortado. |
| 11 | Nicolás | 24/Oct/2026 | Clientes | Funcionalidad faltante | Falta un botón para eliminar clientes. Se usa poco, así que no debe estar muy a mano y tiene que pedir confirmación, pero debe existir. |
| 12 | Nicolás | 24/Oct/2026 | Cierre diario | Rediseño | Hay que cambiar todo el cierre diario. Primero debe mostrar los movimientos del día (entradas y salidas, ganancias y gastos). Después, la carga de los saldos físicos o reales. Debe mostrar con claridad la diferencia entre el saldo esperado y el saldo real. Los saldos reales se cargan siempre por su valor en dólares, sea cual sea la moneda (pesos, euros, libras, etc.). Se carga un valor en USD por cada moneda, y puede haber varios renglones para una misma moneda porque se pueden tener, por ejemplo, euros comprados a distintas cotizaciones. |
| 13 | Nicolás | 25/Oct/2026 | Cierre diario — Movimientos | UX / Regla de negocio | En "Movimientos" no se entiende qué hay cargado. En general los movimientos del día son: **cables** (ingreso, egreso y comisión), **USDT** (ingreso, egreso y comisión), **gastos** (de la oficina y del jefe; algunos gastos del jefe los devuelve y otros no) y la **ganancia**. En cables y USDT, la diferencia entre ingreso y egreso menos la comisión deja implícita la ganancia. Las comisiones (de cables y USDT) las **paga** la oficina. Un gasto del jefe que se devuelve puede quedar como deuda del jefe con la oficina o como gasto del día (según el caso). Todos estos movimientos son siempre en **dólares**. |
| 14 | Nicolás | 25/Oct/2026 | Menú lateral | Bug | Con el menú expandido no aparece el botón para elegir el tema (claro u oscuro). |
| 15 | Nicolás | 25/Oct/2026 | Layout general | UX | Las páginas no aprovechan todo el ancho disponible. |
| 16 | Nicolás | 25/Oct/2026 | Usuarios | Bug/UX | La página de usuarios no está bien centrada. |
| 17 | Nicolás | 25/Oct/2026 | Mesa de Operaciones | Funcionalidad faltante | Faltan los pares Real/USD y Libra/USD. |
| 18 | Nicolás | 25/Oct/2026 | Menú / sesión | Bug | No aparece el botón para cerrar sesión. Causa: sólo existía con el menú lateral expandido en escritorio; faltaba con el menú colapsado y en pantallas chicas (también en el panel del cadete). **Corregido**: ahora está en los tres casos. |
| 19 | Nicolás | 25/Oct/2026 | Clientes / Operaciones | Regla de negocio | Algunos clientes tienen saldo con la oficina y operan con ese saldo. En esos casos se hace la operación sin tener que ir a buscar nada (no hay retiro ni entrega física). Son pocos casos, pero existen. **Aclaraciones (25/Oct):** (a) el sistema debe llevar el seguimiento del saldo de cada cliente; (b) en general no se permite que el cliente quede debiendo a la oficina, pero puede suceder (saldo negativo admitido); (c) el saldo del cliente no entra en el cálculo del cierre diario, pero los saldos de los clientes sí deben figurar en el reporte de cierre que se le envía al jefe al terminar cada día (el reporte se envía por WhatsApp; hoy la app no lo genera); (d) algunos saldos de clientes forman parte del saldo operativo de la caja y otros no: si forma parte de la caja, sus movimientos se reflejan en los movimientos del cierre.; (e) el saldo es siempre en USD; (f) si el saldo forma parte de la caja o no se define por cliente; (g) el cliente puede sumar o retirar saldo sin una operación de cambio, y esos movimientos los carga solo el ADMIN; (h) cuando el cliente suma saldo, siempre entrega efectivo (no hay depósitos bancarios entrantes: cierra U6); (j) U7: los tramos del e-ticket deben sumar exactamente la operación; si no coinciden, no se guarda; (i) el reporte de WhatsApp muestra ganancias, saldo de caja y balance = saldo de caja − saldos de clientes dentro de la caja (los separados se informan aparte; confirmado 25/Oct). |
| 20 | Nicolás | 25/Oct/2026 | Mesa de Operaciones | Bug/UX | Las operaciones deben aparecer siempre en el orden en que fueron cargadas: la primera operación cargada va siempre arriba. |

## Estado de las observaciones 9–12 (24/Oct/2026, sin commitear)

- **#9 Dashboard:** `/admin` muestra datos generales (ganancia del día, operaciones de hoy, pendientes, volumen, ganancia por par, operaciones por operador, último cierre). La planilla quedó solo en la Mesa de Operaciones (`/admin/operations`). La ganancia del dashboard incluye operaciones pendientes; la del cierre, solo las finalizadas. Se sacó el "volumen por operador" porque el backend (`kpis/operador`) lo suma en la moneda de la operación y no en USD: error previo, queda pendiente.
- **#10 Modal cortado:** la animación de entrada de la página dejaba aplicado un `transform`, y los `position: fixed` quedaban relativos a la página. Se corrigió en `globals.css` (`.animate-in` con `backwards`); arregla todos los modales.
- **#11 Eliminar cliente:** al pie del detalle del cliente, con confirmación y solo para ADMIN. Es una baja lógica (`activo = false`): sus operaciones y e-tickets se conservan, y deja de aparecer en la lista y en la planilla.
- **#12 Cierre diario:** pantalla nueva conectada a la API: (1) movimientos del día por moneda, ganancia, comisiones y gastos; (2) saldos reales en USD, con varios renglones por moneda y detalle opcional; (3) esperado contra real con la diferencia destacada (sobrante o faltante). Backend: `GET /closing/preview`, `POST /closing` con `saldosReales` y tabla nueva `cierre_saldo_real` (migración `20261024230000`). **Decidido (25/Oct):** alcanza con el valor en USD y un detalle opcional; no se carga cantidad en moneda original ni cotización.

## Estado de las observaciones 13–17 (25/Oct/2026, sin commitear)

- **#13 Movimientos del cierre:** la sección 1 del cierre muestra ahora bloques separados, todos en USD: **Cables**, **USDT** y **Gastos** (cada uno con su formulario de carga y la opción de borrar mientras el día no esté cerrado), además de las operaciones de cambio. Arriba hay un resumen: ganancia del día (cambio + cables + USDT), gastos del día, jefe a devolver y resultado.
  - Ganancia de cables y USDT = ingreso − egreso − comisión (la comisión la paga la oficina).
  - Gastos: *Oficina* y *Jefe · gasto del día* cuentan como gasto del día; *Jefe · a devolver* sale de la caja pero queda como deuda del jefe, no como gasto.
  - Saldo esperado = saldo inicial + resultado − jefe a devolver.
  - Backend: `POST/DELETE /movimientos/{cables,usdt,gastos}`. Migración `20261025010000_movimientos_usd`: tabla `usdt_operacion`, gasto con `montoUsd` y `tipo`, cierre con ganancia de cables/USDT y deuda del jefe. Los gastos viejos en ARS se siguen mostrando, convertidos con el TC de cierre. Al cerrar, cables, USDT y gastos quedan ligados al cierre y no se pueden borrar.
- **#14 Botón de tema:** ahora está arriba en el menú, junto al de colapsar, y se ve con el menú expandido y colapsado.
- **#15 Ancho:** en la Mesa, Compras y Ventas van lado a lado desde 1440 px (antes, desde 1536). Se corrigió una regla CSS de las tablas que nunca se aplicaba por especificidad. Pendiente de confirmar si había otra página que no aprovechaba el ancho.
- **#16 Usuarios:** usa el contenedor de página estándar (márgenes y título como el resto).
- **#17 Pares:** se agregaron GBP/USD (Libra, dólares por libra) y USD/BRL (Real, reales por dólar) con la migración `20261025000000_pares_gbp_brl`. Las cotizaciones son **de referencia** y hay que actualizarlas en Cotizaciones antes de operar.

## Estado de las observaciones 19–20, U6/U7 y volumen por operador (25/Oct/2026, sin commitear)

- **#20 Orden de la Mesa:** las operaciones se muestran en orden de carga (por número correlativo), con la primera cargada arriba, tanto en Compras como en Ventas.
- **#9 Volumen por operador:** `kpis/operador` suma el volumen en USD (igual que `kpis/par`) y el dashboard vuelve a mostrar la columna Volumen.
- **U7 (opción a):** un e-ticket vinculado a una operación sólo se guarda si sus tramos suman exactamente lo que la operación entrega y recibe, en las mismas monedas (se puede partir en varios tramos). Con un e-ticket activo, la operación no cambia de monto, cotización ni cobertura: hay que cancelar el e-ticket primero.
- **U6:** un retiro por depósito se rechaza con "La oficina no recibe depósitos".
- **#19 Saldos de clientes:**
  - En la ficha del cliente: saldo en USD (en rojo si es negativo), custodia "Dentro de la caja" / "Separado de la caja", botones Ingreso / Retiro (sólo ADMIN) e historial de movimientos.
  - En el e-ticket, la cobertura "USD contra saldo": la pata en USD no lleva tramos y se descuenta o se suma al saldo del cliente cuando la operación se completa. Si la operación vuelve a pendiente, se anula con un contraasiento.
  - En el cierre: bloque "Saldos de clientes" con los movimientos del día; sólo los de clientes con el saldo en caja suman o restan al saldo esperado. Al guardar el cierre se guarda la foto de saldos de cada cliente.
  - Reporte para el jefe (sección 4 del cierre guardado): ganancias, saldo de caja, saldos de clientes y balance, con botones Copiar y Enviar por WhatsApp.
  - **Confirmado por Nicolás (25/Oct):** el balance resta sólo los saldos de clientes que están dentro de la caja; los separados se informan aparte.
- **Bug encontrado:** `PUT /operations/:id` devolvía siempre 400 ("Expected object, received string") porque la validación también se aplicaba al id de la URL. Corregido: editar una operación desde la Mesa o pasarla a "en curso" vuelve a funcionar.
