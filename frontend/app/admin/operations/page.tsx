'use client';

import { useState, useMemo } from 'react';
import { Plus, Eye, Trash2, SlidersHorizontal, Search } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';
import { SearchBar, Pagination, EmptyState } from '@/components/ui';

type OpType = 'Compra' | 'Venta' | 'Transferencia';
type OpStatus = 'Completada' | 'Pendiente' | 'Rechazada' | 'En Proceso';

interface Operation {
  id: string; client: string; dni: string; type: OpType;
  amount: number; rate: number; total: number;
  status: OpStatus; time: string; operator: string;
}

const mockOperations: Operation[] = [
  { id: 'OP-001', client: 'Carlos Méndez', dni: '30.456.789', type: 'Compra', amount: 150000, rate: 1050, total: 157500000, status: 'Completada', time: '25/09 10:32', operator: 'Nicolás G.' },
  { id: 'OP-002', client: 'Ana Rodríguez', dni: '28.123.456', type: 'Venta', amount: 250000, rate: 1048, total: 262000000, status: 'Pendiente', time: '25/09 11:15', operator: 'María L.' },
  { id: 'OP-003', client: 'Miguel Torres', dni: '32.789.012', type: 'Compra', amount: 500000, rate: 1049, total: 524500000, status: 'Completada', time: '25/09 11:48', operator: 'Nicolás G.' },
  { id: 'OP-004', client: 'Laura Sánchez', dni: '27.654.321', type: 'Venta', amount: 80000, rate: 1051, total: 84080000, status: 'Completada', time: '25/09 12:02', operator: 'Carlos P.' },
  { id: 'OP-005', client: 'Roberto Díaz', dni: '31.234.567', type: 'Compra', amount: 320000, rate: 1050, total: 336000000, status: 'Rechazada', time: '25/09 12:30', operator: 'Nicolás G.' },
  { id: 'OP-006', client: 'Fernanda López', dni: '29.876.543', type: 'Transferencia', amount: 100000, rate: 1049, total: 104900000, status: 'En Proceso', time: '25/09 13:10', operator: 'María L.' },
  { id: 'OP-007', client: 'Juan Martínez', dni: '33.456.789', type: 'Venta', amount: 75000, rate: 1052, total: 78900000, status: 'Completada', time: '25/09 13:45', operator: 'Carlos P.' },
  { id: 'OP-008', client: 'Patricia Ruiz', dni: '26.543.210', type: 'Compra', amount: 200000, rate: 1050, total: 210000000, status: 'Pendiente', time: '25/09 14:00', operator: 'Nicolás G.' },
];

const typeClass: Record<OpType, string> = {
  Compra: 'badge-success', Venta: 'badge-info', Transferencia: 'badge-neutral',
};
const statusClass: Record<OpStatus, string> = {
  Completada: 'badge-success', Pendiente: 'badge-warning',
  Rechazada: 'badge-danger', 'En Proceso': 'badge-info',
};

const PER_PAGE = 5;

export default function OperationsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return mockOperations.filter((op) => {
      const okSearch = !q || op.client.toLowerCase().includes(q)
        || op.id.toLowerCase().includes(q) || op.dni.includes(search);
      return okSearch && (type === 'all' || op.type === type) && (status === 'all' || op.status === status);
    });
  }, [search, type, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const columns: DataColumn<Operation>[] = [
    { header: 'ID', primary: true, cell: (o) => <span className="mono text-[13px]" style={{ color: 'var(--blue)' }}>{o.id}</span> },
    { header: 'Estado', trailing: true, align: 'center', cell: (o) => <span className={`badge ${statusClass[o.status]}`}>{o.status}</span> },
    { header: 'Cliente', cell: (o) => (
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-medium truncate">{o.client}</p>
        <p className="m-0 caption mono" style={{ color: 'var(--warm-gray-3)' }}>{o.dni}</p>
      </div>
    ) },
    { header: 'Tipo', cell: (o) => <span className={`badge ${typeClass[o.type]}`}>{o.type}</span> },
    { header: 'Monto', align: 'right', cell: (o) => <span className="currency">{o.amount.toLocaleString('es-AR')} USD</span> },
    { header: 'Tasa', align: 'right', hideOnMobile: true, cell: (o) => <span className="currency" style={{ color: 'var(--warm-gray-2)' }}>{o.rate.toLocaleString('es-AR')}</span> },
    { header: 'Total ARS', align: 'right', cell: (o) => <span className="currency font-medium">{o.total.toLocaleString('es-AR')}</span> },
    { header: 'Acciones', align: 'center', hideOnMobile: true, cell: () => (
      <div className="flex items-center justify-center gap-1">
        <button className="btn btn-icon" aria-label="Ver detalle"><Eye className="w-4 h-4" /></button>
        <button className="btn btn-icon" aria-label="Eliminar"><Trash2 className="w-4 h-4" style={{ color: 'var(--danger)' }} /></button>
      </div>
    ) },
  ];

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Operaciones</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Gestión completa de operaciones de cambio
          </p>
        </div>
        <button className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </header>

      {/* Búsqueda + filtros */}
      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <SearchBar
            placeholder="Buscar cliente, ID o DNI..."
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
          />
          <button
            className={`btn btn-icon shrink-0 sm:hidden ${showFilters ? 'nav-item-active' : ''}`}
            onClick={() => setShowFilters((s) => !s)}
            aria-label="Filtros"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 xs:grid-cols-2 gap-2.5`}>
          <select className="select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="all">Todos los tipos</option>
            <option value="Compra">Compra</option>
            <option value="Venta">Venta</option>
            <option value="Transferencia">Transferencia</option>
          </select>
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Todos los estados</option>
            <option value="Completada">Completada</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Rechazada">Rechazada</option>
            <option value="En Proceso">En Proceso</option>
          </select>
        </div>
      </section>

      <DataList
        columns={columns}
        rows={paged}
        rowKey={(o) => o.id}
        empty={
          <div className="card">
            <EmptyState
              icon={<Search size={26} />}
              title="No se encontraron operaciones"
              description="Probá cambiar la búsqueda o los filtros"
            />
          </div>
        }
      />

      {filtered.length > 0 && (
        <footer className="flex flex-col xs:flex-row items-center justify-between gap-3">
          <span className="caption tabular" style={{ color: 'var(--warm-gray-3)' }}>
            {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
        </footer>
      )}
    </div>
  );
}
