# A2 — Laboratorio visual

Ruta: `/design-lab` (export estático: `/design-lab.html`).
Parámetros de reproducción: `?variant=a&theme=light&screen=operations`.
Valores: `variant=current|a|b|c`, `theme=light|dark`, `screen=operations|ticket|customer`.

## Implementación

- Una única estructura de fixtures inventados, sin importar store/auth/servicios.
- Usa Button, Badge y Panel existentes. CSS bajo `.design-lab` exclusivamente.
- A: superficies opacas, filas densas y listas inset; sin backdrop-filter.
- B: jerarquía serif grande, espacio y un acento ocre; sin backdrop-filter.
- C: contenido opaco; backdrop-filter exclusivamente en navbar.
- Actual: referencia con tokens/materiales de A1, sin aplicar correcciones de contraste.
- El tema se aplica al contenedor local, sin cambiar html, storage ni el sistema A1.
- Buscar y confirmar entrega son interacciones locales, sin persistencia.
- E-ticket cadete no expone montos, saldos, cuentas ni datos bancarios.
- No hay dependencias nuevas ni decisiones sobre la variante de producto.

## Aislamiento R1 y retirada obligatoria en A4

Con ampliación mínima de alcance autorizada, `app/providers.tsx` excluye
AuthProvider/CajaProvider sólo para el pathname exacto `/design-lab`, normalizando
el sufijo `.html` del export y la barra final. No usa coincidencia por prefijo:
otras rutas, incluidas `/admin` y `/cadete`, mantienen ambos providers y sus guards.
ThemeProvider, Toaster, fuente única de tema y anti-flash A1 permanecen comunes.

A4 DEBE retirar esta excepción de `app/providers.tsx` cuando borre design-lab.
No dejar una exclusión huérfana al eliminar el laboratorio.

Las pruebas de navegador abortan tráfico a otros orígenes por seguridad y FALLAN
si se detecta cualquier intento fetch/XHR en el laboratorio, aunque sea abortado.
La referencia A1 puede presentar contrastes inferiores a AA; se registra como
referencia, no se modifica dentro de este ticket. No se elige variante de producto.

## Evidencia externa

Scripts, copia saneada, logs, capturas, manifest SHA-256 y mediciones de contraste:
R1: `/Users/nicolas/.hermes/profiles/carlos-gpt/cache/scratch/A2-R1/ENTREGA-A2-R1.md`.
R0 preservada: `/Users/nicolas/.hermes/profiles/carlos-gpt/cache/scratch/A2/ENTREGA-A2.md`.
No se agregan esos artefactos al repositorio. No se actualiza SEGUIMIENTO.
