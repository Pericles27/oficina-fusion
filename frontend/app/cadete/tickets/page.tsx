'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FileText, CheckCircle, Mail, Eye, Clock, Plus, Search } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';
import { SearchBar, Pagination, EmptyState } from '@/components/ui';

interface Ticket { id: string; client: string; type: string; status: string; date: string; time: string }

const allTickets: Ticket[] = [
  { id: 'ET-001', client: 'Carlos Méndez', type: 'CFE', status: 'Completado', date: '25/09', time: '10:35' },
  { id: 'ET-002', client: 'Ana Rodríguez', type: 'Factura B', status: 'Enviado', date: '25/09', time: '11:18' },
  { id: 'ET-003', client: 'Miguel Torres', type: 'CFE', status: 'Leído', date: '25/09', time: '11:50' },
  { id: 'ET-004', client: 'Laura Sánchez', type: 'Recibo', status: 'Generado', date: '25/09', time: '12:05' },
  { id: 'ET-005', client: 'Roberto Díaz', type: 'Factura B', status: 'Completado', date: '25/09', time: '12:32' },
  { id: 'ET-006', client: 'María López', type: 'CFE', status: 'Enviado', date: '24/09', time: '09:15' },
  { id: 'ET-007', client: 'Jorge Ramírez', type: 'Recibo', status: 'Leído', date: '24/09', time: '10:50' },
  { id: 'ET-008', client: 'Sofía Herrera', type: 'CFE', status: 'Completado', date: '24/09', time: '14:25' },
  { id: 'ET-009', client: 'Diego Morales', type: 'Factura B', status: 'Generado', date: '24/09', time: '16:00' },
  { id: 'ET-010', client: 'Valentina Ruiz', type: 'Recibo', status: 'Enviado', date: '23/09', time: '11:05' },
];

const statusMeta: Record<string, { cls: string; icon: React.ReactNode }> = {
  Generado: { cls: 'badge-info', icon: <FileText className="w-3 h-3" /> },
  Enviado: { cls: 'badge-warning', icon: <Mail className="w-3 h-3" /> },
  Leído: { cls: 'badge-blue', icon: <Eye className="w-3 h-3" /> },
  Completado: { cls: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
};

const PER_PAGE = 5;

export default function TicketsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return allTickets;
    return allTickets.filter((t) =>
      t.id.toLowerCase().includes(q) || t.client.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) || t.status.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const counts = useMemo(() => ({
    Generado: allTickets.filter((t) => t.status === 'Generado').length,
    Enviado: allTickets.filter((t) => t.status === 'Enviado').length,
    Leído: allTickets.filter((t) => t.status === 'Leído').length,
    Completado: allTickets.filter((t) => t.status === 'Completado').length,
  }), []);

  const summary = [
    { label: 'Generados', value: counts.Generado, icon: FileText, tint: 'var(--info)' },
    { label: 'Enviados', value: counts.Enviado, icon: Mail, tint: 'var(--warning)' },
    { label: 'Leídos', value: counts.Leído, icon: Eye, tint: 'var(--blue)' },
    { label: 'Completados', value: counts.Completado, icon: CheckCircle, tint: 'var(--success)' },
  ];

  const columns: DataColumn<Ticket>[] = [
    { header: 'ID', primary: true, cell: (t) => <span className="mono text-[13px]" style={{ color: 'var(--blue)' }}>{t.id}</span> },
    { header: 'Estado', trailing: true, cell: (t) => {
      const m = statusMeta[t.status];
      return <span className={`badge ${m?.cls ?? 'badge-neutral'}`}>{m?.icon}{t.status}</span>;
    } },
    { header: 'Cliente', cell: (t) => t.client },
    { header: 'Tipo', cell: (t) => <span className="badge badge-neutral">{t.type}</span> },
    { header: 'Fecha', align: 'right', cell: (t) => <span className="tabular" style={{ color: 'var(--warm-gray-2)' }}>{t.date} · {t.time}</span> },
  ];

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>E-Tickets</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Gestión de comprobantes electrónicos
          </p>
        </div>
        <Link href="/cadete/tickets/new" className="btn btn-primary btn-sm no-underline">
          <Plus className="w-4 h-4" />
          Nuevo
        </Link>
      </header>

      <section className="grid-4">
        {summary.map((s) => (
          <article key={s.label} className="card stat-card">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label truncate">{s.label}</span>
              <s.icon className="w-[18px] h-[18px] shrink-0" style={{ color: s.tint }} />
            </div>
            <span className="stat-value">{s.value}</span>
          </article>
        ))}
      </section>

      <div className="flex items-center gap-2">
        <SearchBar
          placeholder="Buscar ID, cliente o tipo..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
        />
        <span className="badge badge-blue shrink-0">
          <Clock className="w-3.5 h-3.5" />
          {counts.Generado + counts.Enviado}
        </span>
      </div>

      <DataList
        columns={columns}
        rows={paged}
        rowKey={(t) => t.id}
        empty={
          <div className="card">
            <EmptyState icon={<Search size={26} />} title="Sin resultados"
                        description="No se encontraron e-tickets para esta búsqueda" />
          </div>
        }
      />

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
