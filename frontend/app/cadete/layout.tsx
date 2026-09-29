'use client';

import { LayoutDashboard, ArrowRightLeft, FileText, User } from 'lucide-react';
import { AppShell, type NavEntry } from '@/components/AppShell';

const nav: NavEntry[] = [
  { label: 'Dashboard', short: 'Inicio', href: '/cadete', icon: LayoutDashboard },
  { label: 'Operaciones', short: 'Ops', href: '/cadete/operations', icon: ArrowRightLeft },
  { label: 'E-Tickets', short: 'Tickets', href: '/cadete/tickets', icon: FileText },
  { label: 'Mi Perfil', short: 'Perfil', href: '/cadete/profile', icon: User },
];

export default function CadeteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      brand="Cadete"
      brandIcon={ArrowRightLeft}
      nav={nav}
      user={{ name: 'Carlos Aguilera', role: 'Cadete', initials: 'CA' }}
    >
      {children}
    </AppShell>
  );
}
