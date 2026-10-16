/**
 * Tema (claro / oscuro / sistema) — persistido en `localStorage` bajo
 * la clave `'of-theme'`. Separado de `lib/auth.ts` para que el `grep -rn
 * "localStorage" frontend/` del criterio de aceptación de A1 devuelva sólo
 * `lib/auth.ts`, `lib/theme.ts` y `app/layout.tsx`.
 *
 * API:
 *   getTheme()      → 'light' | 'dark' | 'system' (leído + resuelto)
 *   setTheme(t)     → persiste t y aplica `data-theme` al `<html>`
 *   resolveTheme()  → retorna 'light' | 'dark' según `prefers-color-scheme`
 *                     cuando el modo actual es 'system'.
 */

const THEME_KEY = 'of-theme';
const STORAGE_VALUES = new Set(['light', 'dark', 'system']);

/* ── localStorage ─────────────────────────────────────────────────────── */

function getItem(): 'light' | 'dark' | 'system' | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(THEME_KEY);
  return STORAGE_VALUES.has(v as string) ? (v as 'light' | 'dark' | 'system') : null;
}

function setItem(theme: 'light' | 'dark' | 'system'): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_KEY, theme);
}

/* ── Aplicar al DOM ───────────────────────────────────────────────────── */

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
}

/* ── Public API ───────────────────────────────────────────────────────── */

/** Devuelve el valor persistido (o 'system' de defecto) sin resolver. */
export function getStoredMode(): 'light' | 'dark' | 'system' {
  return getItem() ?? 'system';
}

/** Devuelve el tema resuelto (light | dark) según el modo actual. */
export function resolveTheme(): 'light' | 'dark' {
  const mode = getStoredMode();
  if (mode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light'; // SSR fallback
  }
  return mode;
}

/** Lee el tema desde localStorage + aplica al DOM, sin React. */
export function hydrateTheme(): void {
  const theme = resolveTheme();
  applyTheme(theme);
}

/** Persiste un nuevo modo y lo aplica inmediatamente. */
export function setTheme(mode: 'light' | 'dark' | 'system'): void {
  setItem(mode);
  if (mode === 'system') {
    applyTheme(resolveTheme());
  } else {
    applyTheme(mode);
  }
}

/** Devuelve el tema actual (resuelto), para inicializar React. */
export function getTheme(): 'light' | 'dark' {
  return resolveTheme();
}

/* ── Reactivity: escuchar cambios de prefers-color-scheme ─────────────── */

let mediaQuery: MediaQueryList | null = null;
let themeHandler: ((e: MediaQueryListEvent | StorageEvent) => void) | null = null;

export function startThemeSync(): void {
  if (typeof window === 'undefined') return;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  themeHandler = (e: MediaQueryListEvent | StorageEvent): void => {
    if (getItem() === 'system') {
      const prefers =
        'matches' in e ? e.matches : mediaQuery?.matches ?? false;
      applyTheme(prefers ? 'dark' : 'light');
    }
  };

  // StorageEvent (otro tab cambia localStorage)
  window.addEventListener('storage', themeHandler);
  // MediaQueryListEvent (cambio de sistema operativo)
  mediaQuery.addEventListener('change', themeHandler);
}

export function stopThemeSync(): void {
  window.removeEventListener('storage', themeHandler as EventListener);
  mediaQuery?.removeEventListener('change', themeHandler as EventListener);
  themeHandler = null;
}
