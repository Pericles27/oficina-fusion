'use client';

import { useState } from 'react';
import { SearchBar, Table, TableHeader, TableBody, TableRow, TableCell, Pagination, EmptyState } from '@/components/ui';
import { Plus, Phone, Mail, MapPin } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  dni: string;
  phone: string;
  email: string;
  address: string;
  totalOps: number;
  lastOp: string;
  status: 'Activo' | 'Inactivo' | 'Pendiente';
}

const mockCustomers: Customer[] = [
  { id: 'C001', name: 'Carlos Méndez', dni: '30.456.789', phone: '+54 9 11 2345-6789', email: 'carlos.mendez@email.com', address: 'Av. Corrientes 1234, CABA', totalOps: 24, lastOp: '2026-09-25', status: 'Activo' },
  { id: 'C002', name: 'Ana Rodríguez', dni: '28.123.456', phone: '+54 9 11 3456-7890', email: 'ana.rodriguez@email.com', address: 'Calle Florida 567, CABA', totalOps: 18, lastOp: '2026-09-24', status: 'Activo' },
  { id: 'C003', name: 'Miguel Torres', dni: '32.789.012', phone: '+54 9 11 4567-8901', email: 'miguel.torres@email.com', address: 'Av. 9 de Julio 890, CABA', totalOps: 42, lastOp: '2026-09-25', status: 'Activo' },
  { id: 'C004', name: 'Laura Sánchez', dni: '27.654.321', phone: '+54 9 11 5678-9012', email: 'laura.sanchez@email.com', address: 'San Martín 1567, CABA', totalOps: 8, lastOp: '2026-09-20', status: 'Pendiente' },
  { id: 'C005', name: 'Roberto Díaz', dni: '31.234.567', phone: '+54 9 11 6789-0123', email: 'roberto.diaz@email.com', address: 'Rivadavia 2345, CABA', totalOps: 31, lastOp: '2026-09-23', status: 'Activo' },
  { id: 'C006', name: 'Fernanda López', dni: '29.876.543', phone: '+54 9 11 7890-1234', email: 'fernanda.lopez@email.com', address: 'Santa Fe 678, CABA', totalOps: 5, lastOp: '2026-09-15', status: 'Inactivo' },
  { id: 'C007', name: 'Juan Martínez', dni: '33.456.789', phone: '+54 9 11 8901-2345', email: 'juan.martinez@email.com', address: 'Callao 123, CABA', totalOps: 15, lastOp: '2026-09-22', status: 'Activo' },
  { id: 'C008', name: 'Patricia Ruiz', dni: '26.543.210', phone: '+54 9 11 9012-3456', email: 'patricia.ruiz@email.com', address: 'Mitre 456, La Plata', totalOps: 12, lastOp: '2026-09-21', status: 'Activo' },
];

const statusBadge = (status: Customer['status']) => {
  const cls: Record<string, string> = {
    Activo: 'badge-success',
    Inactivo: 'badge-danger',
    Pendiente: 'badge-warning',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status]}`}>{status}</span>;
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 5;

  const filtered = mockCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dni.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Clientes</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">Gestión de clientes y contactos</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <SearchBar placeholder="Buscar por nombre, DNI o email..." value={search} onChange={setSearch} />

      {/* Stats */}
      <div className="grid grid-3 gap-4">
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <p className="text-sm text-[var(--warm-gray-2)]">Total Clientes</p>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)] mt-1">{mockCustomers.length}</p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <p className="text-sm text-[var(--warm-gray-2)]">Clientes Activos</p>
          <p className="text-2xl font-bold text-[var(--success)] mt-1">
            {mockCustomers.filter((c) => c.status === 'Activo').length}
          </p>
        </div>
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <p className="text-sm text-[var(--warm-gray-2)]">Nuevos esta semana</p>
          <p className="text-2xl font-bold text-[var(--blue)] mt-1">3</p>
        </div>
      </div>

      {/* Table */}
      <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] overflow-hidden">
        {paged.length === 0 ? (
          <EmptyState
            title="No se encontraron clientes"
            description="No hay clientes que coincidan con la búsqueda"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--warm-gray-5)]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">DNI</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Contacto</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Operaciones</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Última Op.</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-[var(--warm-gray-2)] uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <TableBody>
                  {paged.map((c) => (
                    <TableRow key={c.id} className="hover:bg-[var(--warm-gray-4)]/30 transition-colors">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-[var(--warm-gray-1)]">{c.name}</p>
                          <p className="text-xs text-[var(--warm-gray-2)] truncate max-w-xs">{c.address}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-[var(--warm-gray-1)]">{c.dni}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-[var(--warm-gray-2)]">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{c.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-[var(--warm-gray-2)]">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate max-w-xs">{c.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium text-[var(--warm-gray-1)]">
                        {c.totalOps}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--warm-gray-2)]">{c.lastOp}</TableCell>
                      <TableCell className="text-center">{statusBadge(c.status)}</TableCell>
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
        title="Nuevo Cliente"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}