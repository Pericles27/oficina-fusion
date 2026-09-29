'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Check, X, Plus, Paperclip, AlertTriangle } from 'lucide-react';
import { ETicketPanel } from '@/components/ETicketPanel';
import {
  useCaja,
  statsForPar,
  posicionRealizada,
  posicionAbierta,
  resumenTicket,
  OP_STATUS_LABEL,
  type Operation,
  type Par,
  type Tipo,
} from '@/lib/caja-store';

/* =============================================================
   Helpers de formato
   ============================================================= */

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Notación compacta para mobile: 157.200.000 → 157,2M */
const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 10_000) return `${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`;
  return fmt(n);
};

/** Total: completo en desktop, compacto en mobile */
function Total({ value, digits }: { value: number; digits: number }) {
  return (
    <>
      <span className="hidden sm:inline">{fmt(value, digits)}</span>
      <span className="sm:hidden">{fmtCompact(value)}</span>
    </>
  );
}

const quoteDigits = (p: Par) => (p.quote === 'ARS' ? 0 : 2);

/** Indicador del avance del e-ticket en la fila: tramos confirmados. */
function op_patas_pill(o: Operation) {
  if (o.patas.length === 0) return null;
  const r = resumenTicket(o);
  return (
    <span className="dep-pill shrink-0" data-complete={String(r.completo)}
          title={r.incompletas > 0
            ? `Faltan datos en ${r.incompletas} tramo(s)`
            : `${r.confirmadas}/${r.total} tramos confirmados`}>
      {r.incompletas > 0
        ? <AlertTriangle className="w-2.5 h-2.5" />
        : <Paperclip className="w-2.5 h-2.5" />}
      {r.confirmadas}/{r.total}
    </span>
  );
}

/* =============================================================
   Fila de operación — sólo Cliente / Monto / TC / Total.
   Todo lo demás (cobertura, operador, estado) se define al
   cargar el e-ticket, no acá: la planilla queda limpia.
   ============================================================= */

function OpRow({ o, parDef, onOpen, isOpen }: {
  o: Operation;
  parDef: Par;
  onOpen: (id: string) => void;
  isOpen: boolean;
}) {
  const { dispatch } = useCaja();
  const [editing, setEditing] = useState<null | 'cliente' | 'monto' | 'cotiz'>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (field: 'cliente' | 'monto' | 'cotiz') => {
    setEditing(field);
    setDraft(
      field === 'cliente' ? o.cliente
      : field === 'monto' ? String(o.monto)
      : o.cotiz.toFixed(parDef.decimals)
    );
  };

  const commit = () => {
    if (!editing) return;
    if (editing === 'cliente') {
      dispatch({ type: 'EDIT_OP', id: o.id, patch: { cliente: draft } });
    } else {
      const n = parseFloat(draft.replace(',', '.'));
      if (n > 0) dispatch({ type: 'EDIT_OP', id: o.id, patch: { [editing]: n } });
    }
    setEditing(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') setEditing(null);
  };

  const editableProps = (field: 'cliente' | 'monto' | 'cotiz') => ({
    className: `cell-editable${field === 'cliente' ? '' : ' num'}`,
    tabIndex: 0,
    title: 'Doble click para editar · click para ver el e-ticket',
    // Click simple abre el e-ticket (burbujea a la fila).
    // Doble click edita en línea, sin abrir el panel.
    onDoubleClick: (e: React.MouseEvent) => { e.stopPropagation(); startEdit(field); },
    onKeyDown: (e: KeyboardEvent<HTMLTableCellElement>) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(field); }
    },
  });

  const cellInput = (align: 'left' | 'right') => (
    <input
      autoFocus
      className={`input-inline${align === 'left' ? ' input-inline-text' : ''}`}
      value={draft}
      inputMode={align === 'right' ? 'decimal' : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      style={{ textAlign: align }}
    />
  );

  return (
    <tr
      className={`row-clickable${isOpen ? ' row-open' : ''}`}
      onClick={() => { if (!editing) onOpen(o.id); }}
    >
      {/* Cliente — en mobile lleva un punto de estado adelante */}
      {editing === 'cliente'
        ? <td>{cellInput('left')}</td>
        : <td {...editableProps('cliente')}>
            <span className="flex items-center gap-1.5">
              <span className="status-dot sm:hidden" data-status={o.status}
                    title={OP_STATUS_LABEL[o.status]} />
              <span className="truncate">
                {o.cliente || <span className="tone-muted">—</span>}
              </span>
              {/* Avance del e-ticket: tramos confirmados */}
              {op_patas_pill(o)}
            </span>
          </td>}

      {/* Monto */}
      {editing === 'monto'
        ? <td className="num">{cellInput('right')}</td>
        : <td {...editableProps('monto')}>
            <span style={{ fontWeight: 600 }}>
              <Total value={o.monto} digits={0} />
            </span>
          </td>}

      {/* TC */}
      {editing === 'cotiz'
        ? <td className="num">{cellInput('right')}</td>
        : <td {...editableProps('cotiz')}>{fmt(o.cotiz, parDef.decimals)}</td>}

      {/* Total */}
      <td className="num" style={{ fontWeight: 600 }}>
        <Total value={o.contra} digits={quoteDigits(parDef)} />
      </td>

      {/* Estado — click para avanzar pend → ejec → fin.
          En mobile se colapsa al punto junto al cliente. */}
      <td className="hidden sm:table-cell">
        <button
          type="button"
          className="status-chip"
          data-status={o.status}
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CYCLE_OP_STATUS', id: o.id }); }}
          title="Click para avanzar: pendiente → en ejecución → completada"
        >
          <span className="status-chip-dot" />
          {OP_STATUS_LABEL[o.status]}
        </button>
      </td>

      <td className="num">
        <button type="button" className="iconbtn iconbtn-danger"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_OP', id: o.id }); }} title="Eliminar">
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

/* =============================================================
   Blotter (COMPRAS o VENTAS) con fila de carga rápida
   ============================================================= */

function BlotterTable({
  tipo, ops, parDef, totalContra, totalBase, prom, bindFocus, onOpen, openId,
}: {
  tipo: Tipo;
  ops: Operation[];
  parDef: Par;
  totalContra: number;
  totalBase: number;
  prom: number;
  bindFocus?: (fn: () => void) => void;
  onOpen: (id: string) => void;
  openId: string | null;
}) {
  const { state, dispatch } = useCaja();
  const isBuy = tipo === 'C';

  const [cliente, setCliente] = useState('');
  const [monto, setMonto] = useState('');
  const [cotiz, setCotiz] = useState('');

  const clienteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bindFocus?.(() => { clienteRef.current?.focus(); clienteRef.current?.select(); });
  }, [bindFocus]);

  const montoNum = parseFloat(monto.replace(',', '.')) || 0;
  const cotizNum = parseFloat(cotiz.replace(',', '.')) || (isBuy ? parDef.compra : parDef.venta);
  const total = montoNum * cotizNum;

  const commit = useCallback(() => {
    if (montoNum <= 0) { return; }
    dispatch({
      type: 'ADD_OP',
      payload: {
        tipo,
        par: parDef.par,
        monto: montoNum,
        cotiz: cotizNum,
        cliente: cliente.trim(),
        // Cobertura y operador toman el default; se ajustan en el e-ticket
        cobertura: 'efectivo',
        operadorId: state.lastOperadorId || state.traders[0]?.id || '',
      },
    });
    setCliente(''); setMonto(''); setCotiz('');
    setTimeout(() => clienteRef.current?.focus(), 0);
  }, [dispatch, tipo, parDef.par, montoNum, cotizNum, cliente, state.lastOperadorId, state.traders]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setCliente(''); setMonto(''); setCotiz(''); }
  };

  return (
    <div className="blotter">
      <header className="blotter-head">
        <div className="flex items-center gap-2.5">
          <span className={`blotter-title ${isBuy ? 'tone-ok' : 'tone-bad'}`}>
            {isBuy ? 'Compras' : 'Ventas'}
          </span>
          <span className="mesa-tab-count">{ops.length}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="mesa-kpi-label">{isBuy ? '$ Usados' : '$ Hechos'}</span>
          <span className={`text-[15px] font-bold tabular ${isBuy ? 'tone-ok' : 'tone-bad'}`}>
            {fmt(totalContra, quoteDigits(parDef))}
          </span>
        </div>
      </header>

      <div className="blotter-scroll scrollbar" onKeyDown={onKey}>
        <table className="tbl-blotter tbl-blotter--slim">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="num">
                <span className="hidden sm:inline">Monto ({parDef.base})</span>
                <span className="sm:hidden">{parDef.base}</span>
              </th>
              <th className="num">TC</th>
              <th className="num">
                <span className="hidden sm:inline">Total ({parDef.quote})</span>
                <span className="sm:hidden">Total</span>
              </th>
              <th className="hidden sm:table-cell" style={{ width: 82 }}>Estado</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>

          <tbody>
            {ops.map((o) => <OpRow key={o.id} o={o} parDef={parDef} onOpen={onOpen} isOpen={openId === o.id} />)}

            {/* Carga rápida: Enter confirma */}
            <tr className="blotter-new">
              <td>
                <input ref={clienteRef} className="input-inline input-inline-text"
                       placeholder="cliente" value={cliente}
                       onChange={(e) => setCliente(e.target.value)} list="clientes-list" />
                <datalist id="clientes-list">
                  {state.clientes.map((c) => <option key={c.id} value={c.nombre} />)}
                </datalist>
              </td>
              <td className="num">
                <input className="input-inline" placeholder={`monto ${parDef.base}`}
                       value={monto} inputMode="decimal"
                       onChange={(e) => setMonto(e.target.value)} style={{ textAlign: 'right' }} />
              </td>
              <td className="num">
                <input className="input-inline"
                       placeholder={(isBuy ? parDef.compra : parDef.venta).toFixed(parDef.decimals)}
                       value={cotiz} inputMode="decimal"
                       onChange={(e) => setCotiz(e.target.value)} style={{ textAlign: 'right' }} />
              </td>
              <td className="num">
                {montoNum > 0
                  ? <span className="font-bold" style={{ color: 'var(--blue)' }}>
                      <Total value={total} digits={quoteDigits(parDef)} />
                    </span>
                  : <span className="tone-muted">auto</span>}
              </td>
              <td className="hidden sm:table-cell">
                <span className="tone-muted" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  pend
                </span>
              </td>
              <td className="num">
                <button type="button" className="iconbtn iconbtn-accent" onClick={commit}
                        disabled={montoNum <= 0} title="Confirmar (Enter)">
                  <Check className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <td>
                <span className="mesa-kpi-label">prom </span>
                <span className={isBuy ? 'tone-ok' : 'tone-bad'}>{fmt(prom, parDef.decimals)}</span>
              </td>
              <td className="num">
                <Total value={totalBase} digits={0} /> {parDef.base}
              </td>
              <td />
              <td className="num">
                <Total value={totalContra} digits={quoteDigits(parDef)} />
              </td>
              <td className="hidden sm:table-cell" />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* =============================================================
   Panel completo — tabs por par + KPIs + ambos blotters
   ============================================================= */

export function OperationsBoard({ role = 'admin' }: { role?: 'admin' | 'cadete' }) {
  const { state, dispatch } = useCaja();
  const [par, setPar] = useState(state.pares[0]?.par ?? 'USD/ARS');

  /** Operación cuyo e-ticket está abierto */
  const [openId, setOpenId] = useState<string | null>(null);
  const opAbierta = useMemo(
    () => state.operaciones.find((o) => o.id === openId) ?? null,
    [openId, state.operaciones]
  );

  const parDef = useMemo(
    () => state.pares.find((p) => p.par === par) ?? state.pares[0],
    [par, state.pares]
  );

  const s = useMemo(() => statsForPar(state, par), [state, par]);
  const realizada = useMemo(() => posicionRealizada(state, par), [state, par]);
  const abierta = useMemo(() => posicionAbierta(state, par), [state, par]);

  const focusCompras = useRef<(() => void) | null>(null);

  if (!parDef) {
    return (
      <div className="card p-6 text-center">
        <strong>Sin pares cargados.</strong>
      </div>
    );
  }

  const qd = quoteDigits(parDef);

  return (
    <section className="flex flex-col gap-4 relative">
      {/* Tabs por par */}
      <div className="mesa-tabs">
        {state.pares.map((p) => {
          const st = statsForPar(state, p.par);
          return (
            <button key={p.par} type="button" className="mesa-tab"
                    data-active={p.par === par} onClick={() => setPar(p.par)}>
              <span>{p.nombre}</span>
              <span className="mesa-tab-par">{p.par}</span>
              <span className="mesa-tab-count">{st.ops.length}</span>
            </button>
          );
        })}
        <button type="button" className="mesa-tab ml-auto"
                onClick={() => focusCompras.current?.()} disabled={!state.diaAbierto}>
          <Plus className="w-3.5 h-3.5" />
          Nueva op
        </button>
      </div>

      {/* KPIs de la mesa */}
      <div className="mesa-kpis">
        <Kpi label="$ Usados" value={fmt(s.usados, qd)}
             sub={`${fmt(s.baseCompra)} ${parDef.base} comprados`} />
        <Kpi label="$ Hechos" value={fmt(s.hechos, qd)}
             sub={`${fmt(s.baseVenta)} ${parDef.base} vendidos`} />
        <Kpi label="Ganancia realizada"
             value={`${realizada.realizedQuote >= 0 ? '+' : ''}${fmt(realizada.realizedQuote, qd)}`}
             tone={realizada.matchedBase < 0.01 ? 'muted' : realizada.realizedQuote >= 0 ? 'ok' : 'bad'}
             sub={realizada.matchedBase < 0.01 ? 'sin calzado' : `${fmt(realizada.matchedBase)} ${parDef.base} calzados`} />
        <Kpi label="Posición abierta"
             value={abierta ? `${abierta.isLong ? '+' : '−'}${fmt(Math.abs(abierta.base))}` : '0'}
             tone={!abierta ? 'muted' : abierta.isLong ? 'ok' : 'bad'}
             sub={abierta ? `${abierta.isLong ? 'LONG' : 'SHORT'} · ${fmt(abierta.valorQuote, qd)} ${parDef.quote}` : 'calzada'} />
        <Kpi label="Prom. compra" value={fmt(s.promCompra, parDef.decimals)} tone="ok"
             sub={`${parDef.quote}/${parDef.base}`} />
        <Kpi label="Prom. venta" value={fmt(s.promVenta, parDef.decimals)} tone="bad"
             sub={`spread ${fmt(s.spread, parDef.decimals)}`} />
      </div>

      {/* Blotters — apilados salvo en pantallas muy anchas, así cada
          planilla respira y no se corta la columna de acciones */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <BlotterTable tipo="C" ops={s.compras} parDef={parDef}
                      totalContra={s.usados} totalBase={s.baseCompra} prom={s.promCompra}
                      bindFocus={(fn) => { focusCompras.current = fn; }}
                      onOpen={setOpenId} openId={openId} />
        <BlotterTable tipo="V" ops={s.ventas} parDef={parDef}
                      totalContra={s.hechos} totalBase={s.baseVenta} prom={s.promVenta}
                      onOpen={setOpenId} openId={openId} />
      </div>

      {/* E-Ticket de la operación seleccionada */}
      {opAbierta && (
        <ETicketPanel
          op={opAbierta}
          parDef={parDef}
          role={role}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* Velo si el día está cerrado */}
      {!state.diaAbierto && (
        <div className="mesa-veil">
          <div className="card p-5 text-center flex flex-col gap-3 items-center">
            <strong>El día no está abierto</strong>
            <p className="text-small m-0" style={{ color: 'var(--warm-gray-2)' }}>
              Abrí el turno para empezar a operar.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'ABRIR_DIA' })}>
              Abrir día
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({
  label, value, sub, tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'ok' | 'bad' | 'muted';
}) {
  const color =
    tone === 'ok' ? 'var(--success)'
    : tone === 'bad' ? 'var(--danger)'
    : tone === 'muted' ? 'var(--warm-gray-3)'
    : 'var(--warm-gray-1)';

  return (
    <div className="mesa-kpi">
      <span className="mesa-kpi-label">{label}</span>
      <span className="mesa-kpi-value" style={{ color }}>{value}</span>
      {sub && <span className="mesa-kpi-sub">{sub}</span>}
    </div>
  );
}
