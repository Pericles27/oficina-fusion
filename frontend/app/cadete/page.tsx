'use client';

import Link from 'next/link';
import { ArrowRightLeft, FileText, Clock, TrendingUp, Calendar, Sun } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui';

const statusOpen = true; // mock: dia abierto

const recentOps = [
  { id: 'OP-001', type: 'Compra', status: 'Completada', time: '10:32 AM' },
  { id: 'OP-002', type: 'Venta', status: 'Pendiente', time: '11:15 AM' },
  { id: 'OP-003', type: 'Compra', status: 'Completada', time: '11:48 AM' },
];

export default function CadetePage() {
  const typeBadge = (type: string) =>
    type === 'Compra' ? 'badge-success' : 'badge-info';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">
            Buenos días, Carlos
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4 text-[var(--warm-gray-2)]" />
            <p className="text-sm text-[var(--warm-gray-2)]">
              Jueves, 25 de septiembre de 2026
            </p>
          </div>
        </div>
        <Badge
          variant={statusOpen ? 'success' : 'neutral'}
        >
          <span className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5" />
            Día {statusOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-2 gap-4">
        <Link
          href="/cadete/operations"
          className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[var(--blue)]/10 flex items-center justify-center group-hover:bg-[var(--blue)]/20 transition-colors">
              <ArrowRightLeft className="w-6 h-6 text-[var(--blue)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--warm-gray-1)]">Nueva Operación</h3>
              <p className="text-sm text-[var(--warm-gray-2)]">Registrar compra o venta</p>
            </div>
          </div>
        </Link>

        <Link
          href="/cadete/tickets"
          className="card p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[var(--info)]/10 flex items-center justify-center group-hover:bg-[var(--info)]/20 transition-colors">
              <FileText className="w-6 h-6 text-[var(--info)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--warm-gray-1)]">Ver E-Tickets</h3>
              <p className="text-sm text-[var(--warm-gray-2)]">Gestionar comprobantes electrónicos</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Activity summary */}
      <div className="grid grid-4 gap-4">
        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Operaciones Hoy</span>
            <ArrowRightLeft className="w-5 h-5 text-[var(--warm-gray-2)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)]">12</p>
        </div>

        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">E-Tickets Hoy</span>
            <FileText className="w-5 h-5 text-[var(--warm-gray-2)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)]">8</p>
        </div>

        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Completadas</span>
            <TrendingUp className="w-5 h-5 text-[var(--warm-gray-2)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)]">9</p>
        </div>

        <div className="card p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--warm-gray-2)]">Pendientes</span>
            <Clock className="w-5 h-5 text-[var(--warm-gray-2)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--warm-gray-1)]">3</p>
        </div>
      </div>

      {/* Recent Operations */}
      <div className="card rounded-xl bg-white/60 backdrop-blur-sm border border-[var(--warm-gray-5)]">
        <div className="px-5 py-4 border-b border-[var(--warm-gray-5)]">
          <h2 className="text-lg font-semibold text-[var(--warm-gray-1)]">Actividad Reciente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--warm-gray-5)]">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-[var(--warm-gray-2)]">Código</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-[var(--warm-gray-2)]">Tipo</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-[var(--warm-gray-2)]">Estado</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-[var(--warm-gray-2)]">Hora</th>
              </tr>
            </thead>
            <tbody>
              {recentOps.map((op) => (
                <tr key={op.id} className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3 text-sm font-mono text-[var(--blue)]">{op.id}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(op.type)}`}>
                      {op.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--warm-gray-1)]">{op.status}</td>
                  <td className="px-5 py-3 text-sm text-right text-[var(--warm-gray-2)] tabular">{op.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
