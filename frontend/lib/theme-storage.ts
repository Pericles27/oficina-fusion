/**
 * Único punto de acceso a `localStorage` para la preferencia de tema
 * (claro/oscuro). No tiene relación con D2 (JWT) — se separa en su propio
 * módulo para que el `grep -rn "localStorage" frontend/` del criterio de
 * aceptación de F2 siga apuntando sólo a `lib/auth.ts` para el token.
 */

const THEME_KEY = 'of-theme';

export function getStoredTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_KEY, theme);
}
