'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * F2: la home dejó de ser un selector de rol manual (cualquiera podía
 * elegir "Panel Administrador" sin autenticarse — el agujero que motivó
 * toda la Fase 2). Ahora sólo redirige: sin sesión a /login, con sesión al
 * home real según el rol que vino en el token.
 */
export default function Home() {
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
    const soloCadete = user.roles.length > 0 && user.roles.every((r) => r === 'CADETE');
    router.replace(soloCadete ? '/cadete' : '/admin');
  }, [loading, user, router]);

  return (
    <main className="min-h-dvh grid place-items-center">
      <span
        className="grid place-items-center w-[68px] h-[68px] text-white animate-pulse"
        style={{
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(180deg, var(--blue-hover), var(--blue))',
        }}
      >
        <Building2 className="w-8 h-8" />
      </span>
    </main>
  );
}
