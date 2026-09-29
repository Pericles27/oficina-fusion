'use client';

import Link from 'next/link';
import { Building2, Users, UserCog, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useCaja } from '@/lib/caja-store';

export default function Home() {
  const { state, dispatch } = useCaja();

  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10"
          style={{ paddingTop: 'calc(40px + env(safe-area-inset-top))' }}>
      <div className="w-full max-w-[680px] flex flex-col gap-7 animate-in">
        {/* Brand */}
        <header className="flex flex-col items-center text-center gap-3">
          <span
            className="grid place-items-center w-[68px] h-[68px] text-white"
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(180deg, var(--blue-hover), var(--blue))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 14px 38px var(--blue-glow)',
            }}
          >
            <Building2 className="w-8 h-8" />
          </span>
          <h1 className="display-sm">Oficina Fusion</h1>
          <p className="body-1 max-w-[42ch]" style={{ color: 'var(--warm-gray-2)' }}>
            Sistema integral de gestión de oficina financiera
          </p>
        </header>

        {/* Estado del día */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="label">Estado del día</span>
            <span className={`badge ${state.diaAbierto ? 'badge-success' : 'badge-neutral'}`}>
              {state.diaAbierto ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {state.diaAbierto ? 'Abierto' : 'Cerrado'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <Metric label="Operaciones" value={state.operaciones.length} />
            <Metric label="Clientes" value={state.clientes.length} />
            <Metric label="Pares" value={state.pares.length} />
          </div>

          <div className="flex flex-col xs:flex-row gap-2.5 mt-5">
            <button
              className="btn btn-primary btn-full xs:w-auto"
              onClick={() => dispatch({ type: 'ABRIR_DIA' })}
              disabled={state.diaAbierto}
            >
              <Sun className="w-4 h-4" />
              Abrir día
            </button>
            <button
              className="btn btn-secondary btn-full xs:w-auto"
              onClick={() => dispatch({ type: 'CERRAR_DIA' })}
              disabled={!state.diaAbierto}
            >
              <Moon className="w-4 h-4" />
              Cerrar día
            </button>
          </div>
        </section>

        {/* Accesos */}
        <section className="grid-2">
          <AccessCard
            href="/admin"
            icon={UserCog}
            title="Panel Administrador"
            desc="Operaciones, clientes y cierre"
            tint="var(--blue)"
          />
          <AccessCard
            href="/cadete"
            icon={Users}
            title="Panel Cadete"
            desc="E-tickets y operaciones"
            tint="var(--info)"
          />
        </section>

        <footer className="flex items-center justify-center gap-1.5 caption"
                style={{ color: 'var(--warm-gray-3)' }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Datos protegidos · Decimal exacto · Sesión local
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>{label}</span>
      <span className="text-[22px] font-bold tabular tracking-tight">{value}</span>
    </div>
  );
}

function AccessCard({
  href, icon: Icon, title, desc, tint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tint: string;
}) {
  return (
    <Link href={href} className="no-underline group">
      <div className="card p-5 h-full flex items-center gap-4 transition-transform duration-300 group-active:scale-[0.98]">
        <span
          className="grid place-items-center w-12 h-12 shrink-0 transition-colors"
          style={{
            borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${tint} 14%, transparent)`,
            color: tint,
          }}
        >
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h3 className="heading-3">{title}</h3>
          <p className="text-small m-0 mt-0.5" style={{ color: 'var(--warm-gray-2)' }}>{desc}</p>
        </div>
      </div>
    </Link>
  );
}
