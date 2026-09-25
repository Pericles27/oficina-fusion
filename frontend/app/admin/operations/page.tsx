'use client';

import { useState } from 'react';
import { SearchBar, Table, TableHeader, TableBody, TableRow, TableCell, Pagination, EmptyState } from '@/components/ui';
import { Plus, Filter, Search, ArrowUpDown, Eye, Trash2 } from 'lucide-react';

type OperationType = 'Compra' | 'Venta' | 'Transferencia';
type OperationStatus = 'Completada' | 'Pendiente' | 'Rechazada' | 'En Proceso';

interface Operation {
  id: string;
  client: string;
  dni: string;
  type: OperationType;
  amount: number;
  rate: number;
  total: number;
  status: OperationStatus;
  time: string;
  operator: string;
}

const mockOperations: Operation[] = [
  { id: 'OP-001', client: 'Carlos Méndez', dni: '30.456.789', type: 'Compra', amount: 150000, rate: 1050, total: 157500000, status: 'Completada', time: '2026-09-25 10:32', operator: 'Nicolás G.' },
  { id: 'OP-002', client: 'Ana Rodríguez', dni: '28.123.456', type: 'Venta', amount: 250000, rate: 1048, total: 262000000, status: 'Pendiente', time: '2026-09-25 11:15', operator: 'María L.' },
  { id: 'OP-003', client: 'Miguel Torres', dni: '32.789.012', type: 'Compra', amount: 500000, rate: 1049, total: 524500000, status: 'Completada', time: '2026-09-25 11:48', operator: 'Nicolás G.' },
  { id: 'OP-004', client: 'Laura Sánchez', dni: '27.654.321', type: 'Venta', amount: 80000, rate: 1051, total: 84080000, status: 'Completada', time: '2026-09-25 12:02', operator: 'Carlos P.' },
  { id: 'OP-005', client: 'Roberto Díaz', dni: '31.234.567', type: 'Compra', amount: 320000, rate: 1050, total: 336000000, status: 'Rechazada', time: '2026-09-25 12:30', operator: 'Nicolás G.' },
  { id: 'OP-006', client: 'Fernanda López', dni: '29.876.543', type: 'Transferencia', amount: 100000, rate: 1049, total: 104900000, status: 'En Proceso', time: '2026-09-25 13:10', operator: 'María L.' },
  { id: 'OP-007', client: 'Juan Martínez', dni: '33.456.789', type: 'Venta', amount: 75000, rate: 1052, total: 78900000, status: 'Completada', time: '2026-09-25 13:45', operator: 'Carlos P.' },
  { id: 'OP-008', client: 'Patricia Ruiz', dni: '26.543.210', type: 'Compra', amount: 200000, rate: 1050, total: 210000000, status: 'Pendiente', time: '2026-09-25 14:00', operator: 'Nicolás G.' },
];

const typeBadge = (type: OperationType) => {
  const cls: Record<OperationType, string> = {
    Compra: 'badge-success',
    Venta: 'badge-info',
    Transferencia: 'badge-neutral',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[type]}`}>{type}</span>;
};

const statusBadge = (status: OperationStatus) => {
  const cls: Record<OperationStatus, string> = {
    Completada: 'badge-success',
    Pendiente: 'badge-warning',
    Rechazada: 'badge-danger',
    'En Proceso': 'badge-info',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status]}`}>{status}</span>;
};

export default function OperationsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const perPage = 5;

  const filtered = mockOperations.filter((op) => {
    const matchSearch =
      op.client.toLowerCase().includes(search.toLowerCase()) ||
      op.id.toLowerCase().includes(search.toLowerCase()) ||
      op.dni.includes(search);
    const matchType = filterType === 'all' || op.type === filterType;
    const matchStatus = filterStatus === 'all' || op.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Operaciones</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Gestión completa de operaciones de cambio</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Operación
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SearchBar
          placeholder="Buscar por cliente, ID o DNI..."
          value={search}
          onChange={setSearch}
        />
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="input px-3 py-2 rounded-lg bg-white/60 border border-[var(--warm-gray-5)] text-sm text-[var(--warm-gray-1)] cursor-pointer"
          >
            <option value="all">Todos los tipos</option>
            <option value="Compra">Compra</option>
            <option value="Venta">Venta</option>
            <option value="Transferencia">Transferencia</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="input px-3 py-2 rounded-lg bg-white/60 border border-[var(--warm-gray-5)] text-sm text-[var(--warm-gray-1)] cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="Completada">Completada</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Rechazada">Rechazada</option>
            <option value="En Proceso">En Proceso</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] overflow-hidden">
        {paged.length === 0 ? (
          <EmptyState
            icon={<Search size={32} />}
            title="No se encontraron operaciones"
            description="Intenta cambiar los filtros de búsqueda"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--warm-gray-5)]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Tipo</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Monto</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Tasa</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Total ARS</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Estado</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <TableBody>
                  {paged.map((op) => (
                    <TableRow key={op.id} className="hover:bg-[var(--warm-gray-4)]/30 transition-colors">
                      <TableCell className="font-mono text-sm text-[var(--blue)]">{op.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-[var(--warm-gray-1)]">{op.client}</p>
                          <p className="text-xs text-[var(--warm-gray-2)]">{op.dni}</p>
                        </div>
                      </TableCell>
                      <TableCell>{typeBadge(op.type)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-[var(--warm-gray-1)]">
                        {op.amount.toLocaleString('es-AR')} USD
                      </TableCell>
                      <TableCell className="text-right text-sm text-[var(--warm-gray-2)]">{op.rate.toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right text-sm text-[var(--warm-gray-1)] font-medium">
                        {op.total.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(op.status)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="btn-icon p-1.5 rounded-md hover:bg-[var(--warm-gray-4)] transition-colors cursor-pointer" title="Ver detalle">
                            <Eye className="w-4 h-4 text-[var(--warm-gray-2)]" />
                          </button>
                          <button className="btn-icon p-1.5 rounded-md hover:bg-[var(--warm-gray-4)] transition-colors cursor-pointer" title="Eliminar">
                            <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--warm-gray-5)]">
              <span className="text-sm text-[var(--warm-gray-2)]">
                Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} de {filtered.length} resultados
              </span>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button
        className="btn-primary fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow cursor-pointer"
        title="Nueva Operación"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
