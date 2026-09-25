'use client';

import { useState, useMemo } from 'react';
import { FileText, CheckCircle, Mail, Eye, Clock } from 'lucide-react';
import { SearchBar } from '@/components/ui';
import { Pagination } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { Badge } from '@/components/ui';

const allTickets = [
  { id: 'ET-001', client: 'Carlos Méndez', type: 'CFE', status: 'Completado', date: '2026-09-25', time: '10:35 AM' },
  { id: 'ET-002', client: 'Ana Rodríguez', type: 'Factura B', status: 'Enviado', date: '2026-09-25', time: '11:18 AM' },
  { id: 'ET-003', client: 'Miguel Torres', type: 'CFE', status: 'Leído', date: '2026-09-25', time: '11:50 AM' },
  { id: 'ET-004', client: 'Laura Sánchez', type: 'Recibo', status: 'Generado', date: '2026-09-25', time: '12:05 PM' },
  { id: 'ET-005', client: 'Roberto Díaz', type: 'Factura B', status: 'Completado', date: '2026-09-25', time: '12:32 PM' },
  { id: 'ET-006', client: 'María López', type: 'CFE', status: 'Enviado', date: '2026-09-24', time: '09:15 AM' },
  { id: 'ET-007', client: 'Jorge Ramírez', type: 'Recibo', status: 'Leído', date: '2026-09-24', time: '10:50 AM' },
  { id: 'ET-008', client: 'Sofía Herrera', type: 'CFE', status: 'Completado', date: '2026-09-24', time: '02:25 PM' },
  { id: 'ET-009', client: 'Diego Morales', type: 'Factura B', status: 'Generado', date: '2026-09-24', time: '04:00 PM' },
  { id: 'ET-010', client: 'Valentina Ruiz', type: 'Recibo', status: 'Enviado', date: '2026-09-23', time: '11:05 AM' },
  { id: 'ET-011', client: 'Tomás García', type: 'CFE', status: 'Completado', date: '2026-09-23', time: '01:35 PM' },
  { id: 'ET-012', client: 'Camila Ortiz', type: 'Factura B', status: 'Leído', date: '2026-09-23', time: '04:20 PM' },
  { id: 'ET-013', client: 'Pablo Fernández', type: 'CFE', status: 'Generado', date: '2026-09-22', time: '09:00 AM' },
  { id: 'ET-014', client: 'Lucía Romero', type: 'Recibo', status: 'Enviado', date: '2026-09-22', time: '10:30 AM' },
  { id: 'ET-015', client: 'Andrés Silva', type: 'Factura B', status: 'Completado', date: '2026-09-22', time: '02:45 PM' },
];

const statusStyles: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info'; icon: React.ReactNode }> = {
  Generado: { variant: 'info', icon: <FileText className="w-3 h-3" /> },
  Enviado: { variant: 'warning', icon: <Mail className="w-3 h-3" /> },
  Leído: { variant: 'info', icon: <Eye className="w-3 h-3" /> },
  Completado: { variant: 'success', icon: <CheckCircle className="w-3 h-3" /> },
};

const ITEMS_PER_PAGE = 5;

export default function TicketsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTickets;
    const q = search.toLowerCase();
    return allTickets.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.client.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  // Summary counts
  const counts = {
    Generado: allTickets.filter((t) => t.status === 'Generado').length,
    Enviado: allTickets.filter((t) => t.status === 'Enviado').length,
    Leído: allTickets.filter((t) => t.status === 'Leído').length,
    Completado: allTickets.filter((t) => t.status === 'Completado').length,
  };

  if (filtered.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">E-Tickets</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Gestión de comprobantes electrónicos</p>
        </div>
        <div className="flex justify-center py-20">
          <EmptyState
            variant="data"
            title="Sin resultados"
            description="No se encontraron e-tickets para esta búsqueda"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">E-Tickets</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Gestión de comprobantes electrónicos</p>
        </div>
        <Badge variant="blue">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {counts.Generado + counts.Enviado} activos
          </span>
        </Badge>
      </div>

      {/* Status summary */}
      <div className="grid grid-4 gap-4">
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Generados</span>
            <FileText className="w-5 h-5 text-[var(--info)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] tabular">{counts.Generado}</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Enviados</span>
            <Mail className="w-5 h-5 text-[var(--warning)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] tabular">{counts.Enviado}</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Leídos</span>
            <Eye className="w-5 h-5 text-[var(--blue)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] tabular">{counts.Leído}</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Completados</span>
            <CheckCircle className="w-5 h-5 text-[var(--success)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] tabular">{counts.Completado}</p>
        </div>
      </div>

      {/* Search */}
      <div>
        <SearchBar
          placeholder="Buscar por ID, cliente o tipo..."
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          className="max-w-xl"
        />
      </div>

      {/* Table */}
      <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--warm-gray-5)]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">ID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((ticket) => {
                const style = statusStyles[ticket.status] || { variant: 'neutral', icon: null };
                return (
                  <tr key={ticket.id} className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3 text-sm font-mono text-[var(--blue)]">{ticket.id}</td>
                    <td className="px-5 py-3 text-sm text-[var(--warm-gray-1)]">{ticket.client}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium badge-neutral">
                        {ticket.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={style.variant as any}>
                        <span className="flex items-center gap-1">
                          {style.icon}
                          {ticket.status}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-right text-[var(--warm-gray-2)] tabular">{ticket.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filtered.length}
      />
    </div>
  );
}
