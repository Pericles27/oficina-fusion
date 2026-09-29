'use client';

import { LayoutDashboard, ArrowRightLeft, Users, FileText, DollarSign } from 'lucide-react';
import { AppShell, type NavEntry } from '@/components/AppShell';

const nav: NavEntry[] = [
  { label: 'Dashboard', short: 'Inicio', href: '/admin', icon: LayoutDashboard },
  { label: 'Operaciones', short: 'Ops', href: '/admin/operations', icon: ArrowRightLeft },
  { label: 'Clientes', short: 'Clientes', href: '/admin/customers', icon: Users },
  { label: 'Cierre Diario', short: 'Cierre', href: '/admin/closing', icon: FileText },
  { label: 'Cotizaciones', short: 'Tasas', href: '/admin/quotation', icon: DollarSign },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      brand="Oficina"
      brandIcon={LayoutDashboard}
      nav={nav}
      user={{ name: 'Nicolás García', role: 'Administrador', initials: 'NG' }}
    >
      {children}
    </AppShell>
  );
}
