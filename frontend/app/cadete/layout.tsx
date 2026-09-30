'use client';

import { LayoutDashboard, ArrowRightLeft, FileText, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppShell, type NavEntry } from '@/components/AppShell';
import { RouteGuard } from '@/components/RouteGuard';
import { useAuth } from '@/lib/auth-context';

const nav: NavEntry[] = [
  { label: 'Dashboard', short: 'Inicio', href: '/cadete', icon: LayoutDashboard },
  { label: 'Operaciones', short: 'Ops', href: '/cadete/operations', icon: ArrowRightLeft },
  { label: 'E-Tickets', short: 'Tickets', href: '/cadete/tickets', icon: FileText },
  { label: 'Mi Perfil', short: 'Perfil', href: '/cadete/profile', icon: User },
];

function CadeteShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const nombre = user?.nombre ?? '';
  const initials =
    nombre
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '··';

  return (
    <AppShell
      brand="Cadete"
      brandIcon={ArrowRightLeft}
      nav={nav}
      user={{ name: nombre, role: 'Cadete', initials }}
      onLogout={() => logout().then(() => router.replace('/login'))}
    >
      {children}
    </AppShell>
  );
}

export default function CadeteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allow={['CADETE', 'ADMIN']}>
      <CadeteShell>{children}</CadeteShell>
    </RouteGuard>
  );
}
