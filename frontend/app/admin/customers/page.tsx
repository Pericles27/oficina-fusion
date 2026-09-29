'use client';

import { useState, useMemo } from 'react';
import { Plus, Phone, Mail, Search } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';
import { SearchBar, Pagination, EmptyState } from '@/components/ui';

interface Customer {
  id: string; name: string; dni: string; phone: string; email: string;
  address: string; totalOps: number; lastOp: string;
  status: 'Activo' | 'Inactivo' | 'Pendiente';
}

const mockCustomers: Customer[] = [
  { id: 'C001', name: 'Carlos Méndez', dni: '30.456.789', phone: '+54 9 11 2345-6789', email: 'carlos.mendez@email.com', address: 'Av. Corrientes 1234, CABA', totalOps: 24, lastOp: '25/09/2026', status: 'Activo' },
  { id: 'C002', name: 'Ana Rodríguez', dni: '28.123.456', phone: '+54 9 11 3456-7890', email: 'ana.rodriguez@email.com', address: 'Calle Florida 567, CABA', totalOps: 18, lastOp: '24/09/2026', status: 'Activo' },
  { id: 'C003', name: 'Miguel Torres', dni: '32.789.012', phone: '+54 9 11 4567-8901', email: 'miguel.torres@email.com', address: 'Av. 9 de Julio 890, CABA', totalOps: 42, lastOp: '25/09/2026', status: 'Activo' },
  { id: 'C004', name: 'Laura Sánchez', dni: '27.654.321', phone: '+54 9 11 5678-9012', email: 'laura.sanchez@email.com', address: 'San Martín 1567, CABA', totalOps: 8, lastOp: '20/09/2026', status: 'Pendiente' },
  { id: 'C005', name: 'Roberto Díaz', dni: '31.234.567', phone: '+54 9 11 6789-0123', email: 'roberto.diaz@email.com', address: 'Rivadavia 2345, CABA', totalOps: 31, lastOp: '23/09/2026', status: 'Activo' },
  { id: 'C006', name: 'Fernanda López', dni: '29.876.543', phone: '+54 9 11 7890-1234', email: 'fernanda.lopez@email.com', address: 'Santa Fe 678, CABA', totalOps: 5, lastOp: '15/09/2026', status: 'Inactivo' },
  { id: 'C007', name: 'Juan Martínez', dni: '33.456.789', phone: '+54 9 11 8901-2345', email: 'juan.martinez@email.com', address: 'Callao 123, CABA', totalOps: 15, lastOp: '22/09/2026', status: 'Activo' },
  { id: 'C008', name: 'Patricia Ruiz', dni: '26.543.210', phone: '+54 9 11 9012-3456', email: 'patricia.ruiz@email.com', address: 'Mitre 456, La Plata', totalOps: 12, lastOp: '21/09/2026', status: 'Activo' },
];

const statusClass: Record<Customer['status'], string> = {
  Activo: 'badge-success', Inactivo: 'badge-danger', Pendiente: 'badge-warning',
};

const PER_PAGE = 5;

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return mockCustomers;
    return mockCustomers.filter((c) =>
      c.name.toLowerCase().includes(q) || c.dni.includes(search) || c.email.toLowerCase().includes(q)
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const stats = [
    { label: 'Total Clientes', value: mockCustomers.length, tint: 'var(--warm-gray-1)' },
    { label: 'Activos', value: mockCustomers.filter((c) => c.status === 'Activo').length, tint: 'var(--success)' },
    { label: 'Nuevos (semana)', value: 3, tint: 'var(--blue)' },
  ];

  const columns: DataColumn<Customer>[] = [
    { header: 'Cliente', primary: true, cell: (c) => (
      <div className="min-w-0">
        <p className="m-0 text-[14.5px] font-medium truncate">{c.name}</p>
        <p className="m-0 caption truncate" style={{ color: 'var(--warm-gray-3)' }}>{c.address}</p>
      </div>
    ) },
    { header: 'Estado', trailing: true, align: 'center', cell: (c) => <span className={`badge ${statusClass[c.status]}`}>{c.status}</span> },
    { header: 'DNI', cell: (c) => <span className="mono text-[13px]">{c.dni}</span> },
    { header: 'Ops', align: 'center', cell: (c) => <span className="tabular font-medium">{c.totalOps}</span> },
    { header: 'Contacto', hideOnMobile: true, cell: (c) => (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--warm-gray-2)' }}>
          <Phone className="w-3.5 h-3.5 shrink-0" />{c.phone}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] truncate" style={{ color: 'var(--warm-gray-2)' }}>
          <Mail className="w-3.5 h-3.5 shrink-0" />{c.email}
        </span>
      </div>
    ) },
    { header: 'Última Op.', align: 'right', cell: (c) => <span className="tabular" style={{ color: 'var(--warm-gray-2)' }}>{c.lastOp}</span> },
  ];

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Clientes</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Gestión de clientes y contactos
          </p>
        </div>
        <button className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </header>

      <section className="grid-3">
        {stats.map((s) => (
          <article key={s.label} className="card stat-card">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.tint }}>{s.value}</span>
          </article>
        ))}
      </section>

      <SearchBar
        placeholder="Buscar por nombre, DNI o email..."
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
      />

      <DataList
        columns={columns}
        rows={paged}
        rowKey={(c) => c.id}
        empty={
          <div className="card">
            <EmptyState
              icon={<Search size={26} />}
              title="No se encontraron clientes"
              description="Probá con otro nombre, DNI o email"
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
