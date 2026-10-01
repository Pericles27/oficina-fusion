'use client';

import { RouteGuard } from '@/components/RouteGuard';

/**
 * El layout de /admin permite ADMIN y OPERADOR. La gestión de usuarios es
 * exclusiva de ADMIN, así que este layout anida un guard más estricto.
 *
 * Esto es sólo UX: la autorización real la aplica `@Roles(ADMIN)` en
 * `UsersController` del backend, que devuelve 403 a cualquier otro rol.
 */
export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard allow={['ADMIN']}>{children}</RouteGuard>;
}
