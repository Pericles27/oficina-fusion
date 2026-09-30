/**
 * F2 D2 — único módulo que toca `localStorage`. Ningún otro archivo del
 * frontend debe leer/escribir el token directamente: mitigación obligatoria
 * contra XSS (ver PLAN-PRODUCCION.md §D2). El `grep -rn "localStorage"
 * frontend/` de los criterios de aceptación debe devolver sólo este archivo.
 */

const TOKEN_KEY = 'of_token';

export interface AuthUser {
  id: string;
  username: string;
  nombre: string;
  roles: Array<'ADMIN' | 'OPERADOR' | 'CADETE'>;
  email: string | null;
  activo: boolean;
  bloqueado: boolean;
  bloqueadoHasta: string | null;
  intentosFallidos: number;
  primerLogin: boolean;
  creadoEn: string;
  modificadoEn: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Borra el token. D2 mitigación #4: el logout debe llamar esto ANTES de
 * pegarle al backend, para que un fallo de red no deje la sesión viva en
 * el cliente.
 */
export function clearToken(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Decodifica el payload del JWT sin validar la firma (sólo para leer roles
 *  en el cliente; la validación real la hace siempre el backend). */
export function decodeTokenPayload(token: string): { id: string; username: string; roles: string[]; exp: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}
