'use client';

import { useState, useMemo } from 'react';
import { ArrowRightLeft, Search, Paperclip, Check, Clock } from 'lucide-react';
import { SearchBar, EmptyState } from '@/components/ui';
import { ETicketPanel } from '@/components/ETicketPanel';
import {
  useCaja,
  resumenTicket,
  OP_STATUS_LABEL,
  type Operation,
} from '@/lib/caja-store';

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const statusClass: Record<Operation['status'], string> = {
  finalizada: 'badge-success',
  ejecucion: 'badge-blue',
  pendiente: 'badge-warning',
};

export default function CadeteOperationsPage() {
  const { state } = useCaja();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ops = [...state.operaciones].reverse();
    if (!q) return ops;
    return ops.filter((o) =>
      o.codigo.toLowerCase().includes(q) ||
      o.cliente.toLowerCase().includes(q) ||
      o.par.toLowerCase().includes(q)
    );
  }, [search, state.operaciones]);

  const opAbierta = useMemo(
    () => state.operaciones.find((o) => o.id === openId) ?? null,
    [openId, state.operaciones]
  );

  const parDeAbierta = useMemo(
    () => (opAbierta ? state.pares.find((p) => p.par === opAbierta.par) ?? state.pares[0] : null),
    [opAbierta, state.pares]
  );

  /** Tramos que todavía esperan ejecución, en todas las ops */
  const pendientesTotal = useMemo(
    () => state.operaciones.reduce((s, o) => s + resumenTicket(o).pendientes, 0),
    [state.operaciones]
  );

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Mis operaciones</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Tocá una operación para ver el e-ticket y cargar comprobantes
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-small" style={{ color: 'var(--warm-gray-2)' }}>
          <ArrowRightLeft className="w-4 h-4" />
          <span className="tabular">{filtered.length}</span>
        </span>
      </header>

      {/* Aviso de comprobantes pendientes */}
      {pendientesTotal > 0 && (
        <div className="eticket-balance is-warn">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Te faltan <strong>{pendientesTotal}</strong>{' '}
            {pendientesTotal === 1 ? 'tramo' : 'tramos'} por hacer
          </span>
        </div>
      )}

      <SearchBar
        placeholder="Buscar código, cliente o par…"
        value={search}
        onChange={setSearch}
      />

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Search size={26} />} title="Sin resultados"
                      description="No se encontraron operaciones para esta búsqueda" />
        </div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {filtered.map((o) => {
            const r = resumenTicket(o);
            const listo = r.completo;
            const par = state.pares.find((p) => p.par === o.par);

            return (
              <li key={o.id}>
                <button
                  type="button"
                  className="op-card"
                  onClick={() => setOpenId(o.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="mono text-[12px] font-bold shrink-0" style={{ color: 'var(--blue)' }}>
                        {o.codigo}
                      </span>
                      <span className={`badge ${o.tipo === 'C' ? 'badge-success' : 'badge-info'} shrink-0`}>
                        {o.tipo === 'C' ? 'Compra' : 'Venta'}
                      </span>
                    </span>
                    <span className={`badge ${statusClass[o.status]} shrink-0`}>
                      {OP_STATUS_LABEL[o.status]}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 mt-2">
                    <span className="text-[15px] font-semibold truncate">
                      {o.cliente || 'Sin cliente'}
                    </span>
                    <span className="tabular text-[15px] font-bold shrink-0">
                      {fmt(o.contra, par?.quote === 'ARS' ? 0 : 2)}
                      <span className="text-[11px] font-medium ml-1" style={{ color: 'var(--warm-gray-3)' }}>
                        {par?.quote}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2"
                       style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="caption flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
                      <Clock className="w-3 h-3" />
                      {o.hora} · {o.par}
                    </span>

                    {r.total > 0 ? (
                      <span className="dep-pill" data-complete={String(listo)}>
                        {listo ? <Check className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
                        {r.confirmadas}/{r.total} tramos
                      </span>
                    ) : (
                      <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
                        Sin tramos
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {opAbierta && parDeAbierta && (
        <ETicketPanel
          op={opAbierta}
          parDef={parDeAbierta}
          role="cadete"
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
