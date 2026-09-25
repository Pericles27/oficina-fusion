'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Users,
  FileText,
  DollarSign,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Operaciones', href: '/admin/operations', icon: ArrowRightLeft },
  { label: 'Clientes', href: '/admin/customers', icon: Users },
  { label: 'Cierre Diario', href: '/admin/closing', icon: FileText },
  { label: 'Cotizaciones', href: '/admin/quotation', icon: DollarSign },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white/70 backdrop-blur-xl border-r border-[var(--warm-gray-5)] transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--warm-gray-5)]">
          <Link href="/admin" className="flex items-center gap-2 cursor-pointer select-none">
            <div className="w-8 h-8 rounded-lg bg-[var(--blue)] flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <span className="text-lg font-semibold text-[var(--warm-gray-1)]">Oficina</span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-md hover:bg-[var(--warm-gray-4)] transition-colors cursor-pointer"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-[var(--warm-gray-2)]" />
            ) : (
              <Menu className="w-5 h-5 text-[var(--warm-gray-2)]" />
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer select-none ${
                  active
                    ? 'bg-[var(--blue)] text-white shadow-sm'
                    : 'text-[var(--warm-gray-2)] hover:bg-[var(--warm-gray-4)] hover:text-[var(--warm-gray-1)]'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        {sidebarOpen && (
          <div className="px-4 py-4 border-t border-[var(--warm-gray-5)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--blue)] to-[#5856D6] flex items-center justify-center text-white text-sm font-medium">
                NG
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--warm-gray-1)] truncate">
                  Nicolás García
                </p>
                <p className="text-xs text-[var(--warm-gray-2)] truncate">Administrador</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
