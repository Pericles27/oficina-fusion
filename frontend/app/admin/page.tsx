'use client';

import { ArrowRightLeft, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const operations = [
  { id: 'OP-001', client: 'Carlos Méndez', type: 'Compra', amount: 150000, rate: 1050, status: 'Completada', time: '10:32 AM' },
  { id: 'OP-002', client: 'Ana Rodríguez', type: 'Venta', amount: 250000, rate: 1048, status: 'Pendiente', time: '11:15 AM' },
  { id: 'OP-003', client: 'Miguel Torres', type: 'Compra', amount: 500000, rate: 1049, status: 'Completada', time: '11:48 AM' },
  { id: 'OP-004', client: 'Laura Sánchez', type: 'Venta', amount: 80000, rate: 1051, status: 'Completada', time: '12:02 PM' },
  { id: 'OP-005', client: 'Roberto Díaz', type: 'Compra', amount: 320000, rate: 1050, status: 'Rechazada', time: '12:30 PM' },
];

const quickActions = [
  { label: 'Nueva Compra', icon: ArrowDownRight, color: 'bg-[var(--success)]' },
  { label: 'Nueva Venta', icon: ArrowUpRight, color: 'bg-[var(--blue)]' },
  { label: 'Cotizar', icon: TrendingUp, color: 'bg-[#5856D6]' },
];

export default function AdminPage() {
  const stats = [
    { label: 'Operaciones Hoy', value: '24', change: '+12%', up: true, icon: ArrowRightLeft },
    { label: 'Volumen Total', value: '$2.4M', change: '+8.5%', up: true, icon: TrendingUp },
    { label: 'Clientes Activos', value: '156', change: '+3', up: true, icon: Users },
    { label: 'Tasa del Día', value: '$1,050', change: '-2', up: false, icon: TrendingUp },
  ];

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      Completada: 'badge-success',
      Pendiente: 'badge-warning',
      Rechazada: 'badge-danger',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] || 'badge-neutral'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Dashboard</h1>
        <p className="text-sm text-[var(--warm-gray-2)] mt-1">Resumen general de operaciones</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--warm-gray-2)]">{stat.label}</span>
              <stat.icon className="w-5 h-5 text-[var(--warm-gray-2)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--warm-gray-1)]">{stat.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {stat.up ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--success)]" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-[var(--danger)]" />
              )}
              <span className={`text-xs font-medium ${stat.up ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {stat.change}
              </span>
              <span className="text-xs text-[var(--warm-gray-2)]">vs ayer</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 gap-6">
        {/* Operations Blotter */}
        <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="px-4 py-3 border-b border-[var(--warm-gray-5)]">
            <h2 className="text-lg font-semibold text-[var(--warm-gray-1)]">Operaciones Recientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--warm-gray-5)]">
                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)]">ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Cliente</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Tipo</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Monto</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-[var(--blue)]">{op.id}</td>
                    <td className="px-4 py-3 text-sm text-[var(--warm-gray-1)]">{op.client}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${op.type === 'Compra' ? 'badge-success' : 'badge-info'}`}>
                        {op.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--warm-gray-1)] font-medium">
                      ${op.amount.toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(op.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="px-4 py-3 border-b border-[var(--warm-gray-5)]">
            <h2 className="text-lg font-semibold text-[var(--warm-gray-1)]">Acciones Rápidas</h2>
          </div>
          <div className="p-4 space-y-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-lg bg-white/50 hover:bg-white/80 border border-[var(--warm-gray-5)] transition-all cursor-pointer"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-[var(--warm-gray-1)]">{action.label}</span>
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-[var(--warm-gray-5)]">
            <h3 className="text-sm font-medium text-[var(--warm-gray-1)] mb-2">Tasa en Tiempo Real</h3>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-[var(--warm-gray-2)]">Compra</span>
                <p className="text-lg font-semibold text-[var(--success)]">$1,048</p>
              </div>
              <div className="w-px h-8 bg-[var(--warm-gray-5)]" />
              <div>
                <span className="text-xs text-[var(--warm-gray-2)]">Venta</span>
                <p className="text-lg font-semibold text-[var(--blue)]">$1,052</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
