'use client';

import { LayoutDashboard, ArrowRightLeft, Users, FileText, DollarSign, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppShell, type NavEntry } from '@/components/AppShell';
import { RouteGuard } from '@/components/RouteGuard';
import { useAuth } from '@/lib/auth-context';

const nav: NavEntry[] = [
  { label: 'Dashboard', short: 'Inicio', href: '/admin', icon: LayoutDashboard },
  { label: 'Operaciones', short: 'Ops', href: '/admin/operations', icon: ArrowRightLeft },
  { label: 'Clientes', short: 'Clientes', href: '/admin/customers', icon: Users },
  { label: 'Cierre Diario', short: 'Cierre', href: '/admin/closing', icon: FileText },
  { label: 'Cotizaciones', short: 'Tasas', href: '/admin/quotation', icon: DollarSign },
];

// Gestión de usuarios: sólo ADMIN. Se agrega al nav en runtime para no
// mostrarle al OPERADOR un link que le daría 403.
const navUsuarios: NavEntry = { label: 'Usuarios', short: 'Usuarios', href: '/admin/users', icon: UserCog };

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  // user no puede ser null acá: RouteGuard ya garantizó sesión antes de
  // renderizar los children.
  const nombre = user?.nombre ?? '';
  const esAdmin = user?.roles.includes('ADMIN') ?? false;
  const rol = esAdmin ? 'Administrador' : 'Operador';
  const navFinal = esAdmin ? [...nav, navUsuarios] : nav;
  const initials =
    nombre
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '··';

  return (
    <AppShell
      brand="Oficina"
      brandIcon={LayoutDashboard}
      nav={navFinal}
      user={{ name: nombre, role: rol, initials }}
      onLogout={() => logout().then(() => router.replace('/login'))}
    >
      {children}
    </AppShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allow={['ADMIN', 'OPERADOR']}>
      <AdminShell>{children}</AdminShell>
    </RouteGuard>
  );
}
