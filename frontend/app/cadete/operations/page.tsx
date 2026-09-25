'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowRightLeft } from 'lucide-react';
import { SearchBar } from '@/components/ui';
import { Pagination } from '@/components/ui';
import { EmptyState } from '@/components/ui';

const allOperations = [
  { id: 'OP-001', type: 'Compra', client: 'Carlos Méndez', status: 'Completada', date: '2026-09-25', time: '10:32 AM' },
  { id: 'OP-002', type: 'Venta', client: 'Ana Rodríguez', status: 'Pendiente', date: '2026-09-25', time: '11:15 AM' },
  { id: 'OP-003', type: 'Compra', client: 'Miguel Torres', status: 'Completada', date: '2026-09-25', time: '11:48 AM' },
  { id: 'OP-004', type: 'Venta', client: 'Laura Sánchez', status: 'Completada', date: '2026-09-25', time: '12:02 PM' },
  { id: 'OP-005', type: 'Compra', client: 'Roberto Díaz', status: 'Rechazada', date: '2026-09-25', time: '12:30 PM' },
  { id: 'OP-006', type: 'Venta', client: 'María López', status: 'Completada', date: '2026-09-24', time: '09:10 AM' },
  { id: 'OP-007', type: 'Compra', client: 'Jorge Ramírez', status: 'Pendiente', date: '2026-09-24', time: '10:45 AM' },
  { id: 'OP-008', type: 'Venta', client: 'Sofía Herrera', status: 'Completada', date: '2026-09-24', time: '02:20 PM' },
  { id: 'OP-009', type: 'Compra', client: 'Diego Morales', status: 'Completada', date: '2026-09-24', time: '03:55 PM' },
  { id: 'OP-010', type: 'Venta', client: 'Valentina Ruiz', status: 'Pendiente', date: '2026-09-23', time: '11:00 AM' },
  { id: 'OP-011', type: 'Compra', client: 'Tomás García', status: 'Completada', date: '2026-09-23', time: '01:30 PM' },
  { id: 'OP-012', type: 'Venta', client: 'Camila Ortiz', status: 'Completada', date: '2026-09-23', time: '04:15 PM' },
];

const statusClass: Record<string, string> = {
  Completada: 'badge-success',
  Pendiente: 'badge-warning',
  Rechazada: 'badge-danger',
};

const ITEMS_PER_PAGE = 5;

export default function OperationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOperations;
    const q = search.toLowerCase();
    return allOperations.filter(
      (op) =>
        op.id.toLowerCase().includes(q) ||
        op.client.toLowerCase().includes(q) ||
        op.type.toLowerCase().includes(q) ||
        op.status.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  if (filtered.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Operaciones</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Historial de operaciones realizadas</p>
        </div>
        <div className="flex justify-center py-20">
          <EmptyState
            variant="data"
            title="Sin resultados"
            description="No se encontraron operaciones para esta búsqueda"
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
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Operaciones</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Historial de operaciones realizadas</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--warm-gray-2)]">
          <ArrowRightLeft className="w-4 h-4" />
          <span className="tabular">{filtered.length} total</span>
        </div>
      </div>

      {/* Search */}
      <div>
        <SearchBar
          placeholder="Buscar por código, cliente o tipo..."
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
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Código</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[var(--warm-gray-2)]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((op) => (
                <tr key={op.id} className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-sm font-mono text-[var(--blue)]">{op.id}</td>
                  <td className="px-5 py-3 text-sm text-[var(--warm-gray-1)]">{op.client}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${op.type === 'Compra' ? 'badge-success' : 'badge-info'}`}>
                      {op.type}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[op.status] || 'badge-neutral'}`}>
                      {op.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-right text-[var(--warm-gray-2)] tabular">{op.date}</td>
                </tr>
              ))}
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
