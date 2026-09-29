'use client';

import Link from 'next/link';
import { ArrowRightLeft, FileText, Clock, TrendingUp, Calendar, Sun } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';

const statusOpen = true;

interface Op { id: string; type: 'Compra' | 'Venta'; status: string; time: string }

const recentOps: Op[] = [
  { id: 'OP-001', type: 'Compra', status: 'Completada', time: '10:32' },
  { id: 'OP-002', type: 'Venta', status: 'Pendiente', time: '11:15' },
  { id: 'OP-003', type: 'Compra', status: 'Completada', time: '11:48' },
];

const statusClass: Record<string, string> = {
  Completada: 'badge-success',
  Pendiente: 'badge-warning',
  Rechazada: 'badge-danger',
};

const kpis = [
  { label: 'Operaciones', value: 12, icon: ArrowRightLeft },
  { label: 'E-Tickets', value: 8, icon: FileText },
  { label: 'Completadas', value: 9, icon: TrendingUp },
  { label: 'Pendientes', value: 3, icon: Clock },
];

const columns: DataColumn<Op>[] = [
  { header: 'Código', primary: true, cell: (o) => <span className="mono text-[13px]" style={{ color: 'var(--blue)' }}>{o.id}</span> },
  { header: 'Estado', trailing: true, cell: (o) => <span className={`badge ${statusClass[o.status] ?? 'badge-neutral'}`}>{o.status}</span> },
  { header: 'Tipo', cell: (o) => <span className={`badge ${o.type === 'Compra' ? 'badge-success' : 'badge-info'}`}>{o.type}</span> },
  { header: 'Hora', align: 'right', cell: (o) => <span className="tabular" style={{ color: 'var(--warm-gray-2)' }}>{o.time}</span> },
];

export default function CadetePage() {
  return (
    <div className="page animate-in">
      {/* Saludo */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Buenos días, Carlos</h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Calendar className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
            <p className="text-small m-0" style={{ color: 'var(--warm-gray-2)' }}>
              Viernes, 25 de septiembre de 2026
            </p>
          </div>
        </div>
        <span className={`badge ${statusOpen ? 'badge-success' : 'badge-neutral'}`}>
          <Sun className="w-3.5 h-3.5" />
          Día {statusOpen ? 'Abierto' : 'Cerrado'}
        </span>
      </header>

      {/* Accesos grandes (thumb-friendly) */}
      <section className="grid-2">
        <QuickLink
          href="/cadete/operations"
          icon={ArrowRightLeft}
          title="Nueva Operación"
          desc="Registrar compra o venta"
          tint="var(--blue)"
        />
        <QuickLink
          href="/cadete/tickets"
          icon={FileText}
          title="Ver E-Tickets"
          desc="Gestionar comprobantes"
          tint="var(--info)"
        />
      </section>

      {/* KPIs */}
      <section className="grid-4">
        {kpis.map((k) => (
          <article key={k.label} className="card stat-card">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label truncate">{k.label}</span>
              <k.icon className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
            </div>
            <span className="stat-value">{k.value}</span>
          </article>
        ))}
      </section>

      {/* Actividad */}
      <section>
        <h2 className="mb-3">Actividad reciente</h2>
        <DataList columns={columns} rows={recentOps} rowKey={(o) => o.id} />
      </section>
    </div>
  );
}

function QuickLink({
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
      <div className="card p-5 h-full flex items-center gap-4 active:scale-[0.98] transition-transform duration-300">
        <span
          className="grid place-items-center w-12 h-12 shrink-0"
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
