'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui';

export type Rol = 'ADMIN' | 'OPERADOR' | 'CADETE';

interface RouteGuardProps {
  allow: Rol[];
  children: React.ReactNode;
}

/**
 * D1: la seguridad real la impone el backend (JwtAuthGuard + RolesGuard en
 * cada endpoint). Este guard sólo evita que se vea la UI a quien no
 * corresponde — nunca renderiza el contenido protegido mientras `loading` es
 * true, para no dejar un frame del cierre diario antes de redirigir.
 */
export function RouteGuard({ allow, children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.primerLogin) {
      router.replace('/cambiar-password');
      return;
    }

    const tieneRolPermitido = user.roles.some((r) => allow.includes(r));
    if (!tieneRolPermitido) {
      // Rol incorrecto: a su home, no a /login (ya está autenticado).
      const home = user.roles.includes('CADETE') ? '/cadete' : '/admin';
      router.replace(home);
    }
  }, [loading, user, allow, router]);

  if (loading || !user || user.primerLogin) {
    return <GuardSkeleton />;
  }

  const tieneRolPermitido = user.roles.some((r) => allow.includes(r));
  if (!tieneRolPermitido) {
    return <GuardSkeleton />;
  }

  return <>{children}</>;
}

function GuardSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col gap-4 p-6" aria-busy="true" aria-label="Cargando sesión">
      <Skeleton height="48px" rounded="md" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton height="90px" rounded="lg" />
        <Skeleton height="90px" rounded="lg" />
        <Skeleton height="90px" rounded="lg" />
      </div>
      <Skeleton height="320px" rounded="lg" />
    </div>
  );
}
