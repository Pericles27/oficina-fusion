'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, FileText, Save, Send } from 'lucide-react';

const summaryStats = [
  { label: 'Total Operaciones', value: '24', icon: FileText, color: 'text-[var(--blue)]' },
  { label: 'Volumen USD', value: '$1,030,000', icon: DollarSign, color: 'text-[var(--success)]' },
  { label: 'Efectivo Caja', value: '$48,250,000', icon: DollarSign, color: 'text-[var(--warm-gray-1)]' },
  { label: 'Diferencia', value: '+$125,000', icon: AlertTriangle, color: 'text-[var(--warning)]' },
];

const reconciliationItems = [
  { item: 'Efectivo en Caja - Apertura', esperado: 50000000, real: 50000000, diff: 0, status: 'ok' },
  { item: 'Depósitos Bancarios', esperado: 35000000, real: 35000000, diff: 0, status: 'ok' },
  { item: 'Ingresos por Compras USD', esperado: 280000000, real: 280000000, diff: 0, status: 'ok' },
  { item: 'Ingresos por Ventas USD', esperado: 180000000, real: 180125000, diff: 125000, status: 'diff' },
  { item: 'Egresos por Compras USD', esperado: 200000000, real: 200000000, diff: 0, status: 'ok' },
  { item: 'Egresos por Ventas USD', esperado: 120000000, real: 120000000, diff: 0, status: 'ok' },
  { item: 'Comisiones y Honorarios', esperado: 15000000, real: 14875000, diff: -125000, status: 'diff' },
  { item: 'Efectivo en Caja - Cierre', esperado: 48250000, real: 48375000, diff: 125000, status: 'diff' },
];

const operationsToday = [
  { id: 'OP-001', type: 'Compra', amount: 150000, total: 157500000, status: 'ok' as const },
  { id: 'OP-002', type: 'Venta', amount: 250000, total: 262000000, status: 'ok' as const },
  { id: 'OP-003', type: 'Compra', amount: 500000, total: 524500000, status: 'ok' as const },
  { id: 'OP-004', type: 'Venta', amount: 80000, total: 84080000, status: 'ok' as const },
  { id: 'OP-005', type: 'Compra', amount: 320000, total: 336000000, status: 'alert' as const },
  { id: 'OP-006', type: 'Transferencia', amount: 100000, total: 104900000, status: 'ok' as const },
  { id: 'OP-007', type: 'Venta', amount: 75000, total: 78900000, status: 'ok' as const },
  { id: 'OP-008', type: 'Compra', amount: 200000, total: 210000000, status: 'ok' as const },
];

const formatMoney = (n: number) => n.toLocaleString('es-AR');

const statusIcon = (status: 'ok' | 'alert' | 'error') => {
  if (status === 'ok') return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
  if (status === 'alert') return <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />;
  return <XCircle className="w-4 h-4 text-[var(--danger)]" />;
};

const statusLabel = (status: 'ok' | 'alert' | 'error') => {
  if (status === 'ok') return <Badge variant="success">Conciliado</Badge>;
  if (status === 'alert') return <Badge variant="warning">Con Diferencia</Badge>;
  return <Badge variant="danger">Error</Badge>;
};

export default function ClosingPage() {
  const isPending = true;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--warm-gray-1)]">Cierre Diario</h1>
          <p className="text-sm text-[var(--warm-gray-2)] mt-1">25 de septiembre de 2026</p>
        </div>
        <div className="flex items-center gap-3">
          {isPending ? (
            <>
              <button className="btn-secondary flex items-center gap-2">
                <Save className="w-4 h-4" />
                Guardar Borrador
              </button>
              <button className="btn-primary flex items-center gap-2">
                <Send className="w-4 h-4" />
                Confirmar Cierre
              </button>
            </>
          ) : (
            <Badge variant="success">Cierre Confirmado — 18:30</Badge>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-4 gap-4">
        {summaryStats.map((stat, i) => (
          <Card key={i} className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--warm-gray-2)] flex items-center gap-2">
                <stat.icon className="w-4 h-4" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-2 gap-6">
        {/* Reconciliation Table */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              Conciliación de Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--warm-gray-5)]">
                    <th className="text-left px-3 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Concepto</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Esperado</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Real</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Dif.</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-[var(--warm-gray-2)]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationItems.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--warm-gray-5)] last:border-0 hover:bg-[var(--warm-gray-4)]/30 transition-colors">
                      <td className="px-3 py-2.5 text-sm text-[var(--warm-gray-1)]">{item.item}</td>
                      <td className="px-3 py-2.5 text-sm text-right text-[var(--warm-gray-2)]">{formatMoney(item.esperado)}</td>
                      <td className="px-3 py-2.5 text-sm text-right text-[var(--warm-gray-1)] font-medium">{formatMoney(item.real)}</td>
                      <td className={`px-3 py-2.5 text-sm text-right font-medium ${item.diff > 0 ? 'text-[var(--success)]' : item.diff < 0 ? 'text-[var(--danger)]' : 'text-[var(--warm-gray-2)]'}`}>
                        {item.diff === 0 ? '—' : `${item.diff > 0 ? '+' : ''}${formatMoney(item.diff)}`}
                      </td>
                      <td className="text-center">
                        {statusIcon(item.status === 'ok' ? 'ok' : 'alert')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Operations Summary */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--blue)]" />
              Operaciones del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {operationsToday.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--warm-gray-4)]/30 hover:bg-[var(--warm-gray-4)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[var(--blue)]">{op.id}</span>
                    <Badge variant={op.type === 'Compra' ? 'success' : op.type === 'Venta' ? 'info' : 'neutral'}>
                      {op.type}
                    </Badge>
                    {op.status !== 'ok' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--warm-gray-2)]">{op.amount.toLocaleString('es-AR')} USD</span>
                    <span className="text-sm font-medium text-[var(--warm-gray-1)]">
                      {formatMoney(op.total)} ARS
                    </span>
                    {statusIcon(op.status)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--warm-gray-5)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--warm-gray-2)]">Total del día</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-[var(--warm-gray-1)]">
                    {operationsToday.reduce((s, o) => s + o.amount, 0).toLocaleString('es-AR')} USD
                  </span>
                  <span className="text-sm font-bold text-[var(--blue)]">
                    {formatMoney(operationsToday.reduce((s, o) => s + o.total, 0))} ARS
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner */}
      {isPending && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20">
          <AlertTriangle className="w-5 h-5 text-[var(--warning)] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--warm-gray-1)]">Hay diferencias pendientes de conciliación</p>
            <p className="text-xs text-[var(--warm-gray-2)] mt-0.5">Verifique las 3 partidas con diferencias antes de confirmar el cierre.</p>
          </div>
        </div>
      )}
    </div>
  );
}