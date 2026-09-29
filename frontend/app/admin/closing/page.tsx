'use client';

import { useMemo } from 'react';
import { CheckCircle, AlertTriangle, DollarSign, FileText, Save, Send, Clock } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';

interface ReconItem { item: string; esperado: number; real: number; diff: number }
interface DayOp { id: string; type: string; amount: number; total: number; ok: boolean }

const reconciliation: ReconItem[] = [
  { item: 'Efectivo Caja — Apertura', esperado: 50000000, real: 50000000, diff: 0 },
  { item: 'Depósitos Bancarios', esperado: 35000000, real: 35000000, diff: 0 },
  { item: 'Ingresos por Compras USD', esperado: 280000000, real: 280000000, diff: 0 },
  { item: 'Ingresos por Ventas USD', esperado: 180000000, real: 180125000, diff: 125000 },
  { item: 'Egresos por Compras USD', esperado: 200000000, real: 200000000, diff: 0 },
  { item: 'Comisiones y Honorarios', esperado: 15000000, real: 14875000, diff: -125000 },
  { item: 'Efectivo Caja — Cierre', esperado: 48250000, real: 48375000, diff: 125000 },
];

const dayOps: DayOp[] = [
  { id: 'OP-001', type: 'Compra', amount: 150000, total: 157500000, ok: true },
  { id: 'OP-002', type: 'Venta', amount: 250000, total: 262000000, ok: true },
  { id: 'OP-003', type: 'Compra', amount: 500000, total: 524500000, ok: true },
  { id: 'OP-004', type: 'Venta', amount: 80000, total: 84080000, ok: true },
  { id: 'OP-005', type: 'Compra', amount: 320000, total: 336000000, ok: false },
  { id: 'OP-006', type: 'Transferencia', amount: 100000, total: 104900000, ok: true },
];

const money = (n: number) => n.toLocaleString('es-AR');

const summary = [
  { label: 'Operaciones', value: '24', icon: FileText, tint: 'var(--blue)' },
  { label: 'Volumen USD', value: '$1,03M', icon: DollarSign, tint: 'var(--success)' },
  { label: 'Efectivo Caja', value: '$48,25M', icon: DollarSign, tint: 'var(--warm-gray-1)' },
  { label: 'Diferencia', value: '+$125K', icon: AlertTriangle, tint: 'var(--warning)' },
];

export default function ClosingPage() {
  const pendingDiffs = useMemo(() => reconciliation.filter((r) => r.diff !== 0).length, []);

  const reconColumns: DataColumn<ReconItem>[] = [
    { header: 'Concepto', primary: true, cell: (r) => <span className="text-[14px]">{r.item}</span> },
    { header: 'Dif.', trailing: true, align: 'right', cell: (r) => (
      <span className={`badge ${r.diff === 0 ? 'badge-neutral' : r.diff > 0 ? 'badge-success' : 'badge-danger'}`}>
        {r.diff === 0 ? 'OK' : `${r.diff > 0 ? '+' : ''}${money(r.diff)}`}
      </span>
    ) },
    { header: 'Esperado', align: 'right', cell: (r) => <span className="currency" style={{ color: 'var(--warm-gray-2)' }}>{money(r.esperado)}</span> },
    { header: 'Real', align: 'right', cell: (r) => <span className="currency font-medium">{money(r.real)}</span> },
  ];

  const opsColumns: DataColumn<DayOp>[] = [
    { header: 'ID', primary: true, cell: (o) => (
      <span className="flex items-center gap-2">
        <span className="mono text-[13px]" style={{ color: 'var(--blue)' }}>{o.id}</span>
        {!o.ok && <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} />}
      </span>
    ) },
    { header: 'Tipo', trailing: true, cell: (o) => (
      <span className={`badge ${o.type === 'Compra' ? 'badge-success' : o.type === 'Venta' ? 'badge-info' : 'badge-neutral'}`}>
        {o.type}
      </span>
    ) },
    { header: 'USD', align: 'right', cell: (o) => <span className="currency">{money(o.amount)}</span> },
    { header: 'Total ARS', align: 'right', cell: (o) => <span className="currency font-medium">{money(o.total)}</span> },
  ];

  return (
    <div className="page animate-in">
      <header className="flex flex-col gap-3">
        <div>
          <h1>Cierre Diario</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            25 de septiembre de 2026
          </p>
        </div>
        {/* Botones full-width en mobile */}
        <div className="flex flex-col xs:flex-row gap-2.5">
          <button className="btn btn-secondary btn-full xs:w-auto">
            <Save className="w-4 h-4" />
            Guardar borrador
          </button>
          <button className="btn btn-primary btn-full xs:w-auto">
            <Send className="w-4 h-4" />
            Confirmar cierre
          </button>
        </div>
      </header>

      {pendingDiffs > 0 && (
        <div className="card p-4 flex items-start gap-3"
             style={{ borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-medium">Hay diferencias pendientes de conciliación</p>
            <p className="m-0 mt-0.5 text-small" style={{ color: 'var(--warm-gray-2)' }}>
              Verificá las {pendingDiffs} partidas con diferencia antes de confirmar.
            </p>
          </div>
        </div>
      )}

      <section className="grid-4">
        {summary.map((s) => (
          <article key={s.label} className="card stat-card">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label truncate">{s.label}</span>
              <s.icon className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
            </div>
            <span className="stat-value" style={{ color: s.tint }}>{s.value}</span>
          </article>
        ))}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-[18px] h-[18px]" style={{ color: 'var(--success)' }} />
          <h2>Conciliación de caja</h2>
        </div>
        <DataList columns={reconColumns} rows={reconciliation} rowKey={(r) => r.item} />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-[18px] h-[18px]" style={{ color: 'var(--blue)' }} />
          <h2>Operaciones del día</h2>
        </div>
        <DataList columns={opsColumns} rows={dayOps} rowKey={(o) => o.id} />

        <div className="card p-4 mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="label">Total del día</span>
          <div className="flex items-center gap-4">
            <span className="currency text-[15px]">
              {money(dayOps.reduce((s, o) => s + o.amount, 0))} USD
            </span>
            <span className="currency text-[15px] font-bold" style={{ color: 'var(--blue)' }}>
              {money(dayOps.reduce((s, o) => s + o.total, 0))} ARS
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
