'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export interface NavEntry {
  label: string;
  /** Etiqueta corta para la tab bar mobile */
  short?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export interface AppShellProps {
  brand: string;
  brandIcon: ComponentType<{ className?: string }>;
  nav: NavEntry[];
  user: { name: string; role: string; initials: string };
  children: React.ReactNode;
}

function isActive(pathname: string, href: string) {
  if (href === '/admin' || href === '/cadete') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ brand, brandIcon: BrandIcon, nav, user, children }: AppShellProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="min-h-dvh md:flex">
      {/* ── Sidebar: solo desktop ── */}
      <aside
        className={`hidden md:flex md:flex-col md:shrink-0 md:sticky md:top-0 md:h-dvh glass-thick
                    transition-[width] duration-500 ease-[var(--ease-smooth)]
                    ${expanded ? 'md:w-[264px]' : 'md:w-[78px]'}`}
        style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link
            href={nav[0].href}
            className="flex items-center gap-2.5 min-w-0 no-underline"
            aria-label={brand}
          >
            <span
              className="grid place-items-center w-10 h-10 shrink-0 text-white"
              style={{
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(180deg, var(--blue-hover), var(--blue))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 5px 16px var(--blue-glow)',
              }}
            >
              <BrandIcon className="w-5 h-5" />
            </span>
            {expanded && (
              <span className="text-[17px] font-semibold tracking-tight truncate"
                    style={{ color: 'var(--warm-gray-1)' }}>
                {brand}
              </span>
            )}
          </Link>
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="btn btn-icon"
              aria-label="Colapsar menú"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="btn btn-icon mx-auto mb-2"
            aria-label="Expandir menú"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        <div className="divider mx-4" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar px-3 py-3 flex flex-col gap-1">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'nav-item-active' : ''} ${expanded ? '' : 'justify-center'}`}
                title={expanded ? undefined : item.label}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="divider mx-4" />
        <div className={`px-4 py-4 flex items-center gap-3 ${expanded ? '' : 'justify-center'}`}>
          <span className="avatar avatar-md">{user.initials}</span>
          {expanded && (
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium truncate m-0"
                 style={{ color: 'var(--warm-gray-1)' }}>
                {user.name}
              </p>
              <p className="text-[11.5px] truncate m-0" style={{ color: 'var(--warm-gray-3)' }}>
                {user.role}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header mobile */}
        <header
          className="md:hidden sticky top-0 z-40 glass-thick flex items-center justify-between gap-3 px-4 py-3"
          style={{
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            paddingTop: 'calc(12px + env(safe-area-inset-top))',
          }}
        >
          <Link href={nav[0].href} className="flex items-center gap-2.5 no-underline min-w-0">
            <span
              className="grid place-items-center w-9 h-9 shrink-0 text-white"
              style={{
                borderRadius: 'var(--radius-xs)',
                background: 'linear-gradient(180deg, var(--blue-hover), var(--blue))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 4px 12px var(--blue-glow)',
              }}
            >
              <BrandIcon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight truncate"
                  style={{ color: 'var(--warm-gray-1)' }}>
              {brand}
            </span>
          </Link>
          <span className="avatar avatar-sm">{user.initials}</span>
        </header>

        {/* Main — padding-bottom deja lugar a la tab bar */}
        <main className="flex-1 min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Tab bar: solo mobile ── */}
      <nav className="tabbar md:hidden" aria-label="Navegación principal">
        {nav.slice(0, 5).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tabbar-item ${active ? 'tabbar-item-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="w-[22px] h-[22px]" />
              <span className="truncate max-w-full">{item.short ?? item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
