'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Upload, FileCheck2, Check, AlertTriangle, Building2, User,
  Clock, Paperclip, ArrowUpRight, ArrowDownLeft, Banknote, Wallet, MapPin, Phone,
} from 'lucide-react';
import {
  useCaja,
  clienteById,
  resumenTicket,
  camposFaltantes,
  METODO_LABEL,
  OP_STATUS_LABEL,
  type Pata,
  type MetodoPata,
  type Operation,
  type Par,
} from '@/lib/caja-store';

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 10_000) return `${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`;
  return fmt(n);
};

const digitsFor = (moneda: string) => (moneda === 'ARS' ? 0 : 2);

const estadoPataClass: Record<Pata['estado'], string> = {
  pendiente: 'badge-warning',
  hecho: 'badge-info',
  confirmado: 'badge-success',
};

const estadoPataLabel: Record<Pata['estado'], string> = {
  pendiente: 'Pendiente',
  hecho: 'Hecho',
  confirmado: 'Confirmado',
};

const METODO_ICON: Record<MetodoPata, typeof Banknote> = {
  efectivo: Banknote,
  deposito: Building2,
  saldo: Wallet,
};

/* =============================================================
   E-Ticket de una operación.

   La carga depende del TIPO de operación: toda op tiene dos
   tramos (lo que la caja entrega y lo que recibe) y cada uno
   se liquida por un método que pide campos distintos.

   role='admin'  → arma el ticket: método y datos de cada tramo
   role='cadete' → ejecuta: lee los datos y sube el comprobante
   ============================================================= */

export function ETicketPanel({
  op, parDef, role, onClose,
}: {
  op: Operation;
  parDef: Par;
  role: 'admin' | 'cadete';
  onClose: () => void;
}) {
  const { state, dispatch } = useCaja();
  const cliente = clienteById(state, op.clienteId);
  const resumen = useMemo(() => resumenTicket(op), [op]);
  const isAdmin = role === 'admin';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // El panel se monta en el body: dentro del árbol de la página,
  // un ancestro con backdrop-filter rompe el position:fixed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!mounted) return null;

  const entregamos = op.patas.find((p) => p.direccion === 'entregamos');
  const recibimos = op.patas.find((p) => p.direccion === 'recibimos');

  return createPortal(
    <>
      <div className="eticket-backdrop" onClick={onClose} aria-hidden />

      <aside className="eticket" role="dialog" aria-label={`E-Ticket ${op.codigo}`}>
        <header className="eticket-head">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-[13px] font-bold" style={{ color: 'var(--blue)' }}>
                {op.codigo}
              </span>
              <span className={`badge ${op.tipo === 'C' ? 'badge-success' : 'badge-info'}`}>
                {op.tipo === 'C' ? 'Compra' : 'Venta'}
              </span>
              <span className={`badge ${
                op.status === 'finalizada' ? 'badge-success'
                : op.status === 'ejecucion' ? 'badge-blue' : 'badge-warning'}`}>
                {OP_STATUS_LABEL[op.status]}
              </span>
            </div>
            <h2 className="heading-2 mt-1.5 truncate">{op.cliente || 'Sin cliente'}</h2>
            <p className="m-0 caption flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
              <Clock className="w-3.5 h-3.5" />
              {op.hora} · {parDef.par} · TC {fmt(op.cotiz, parDef.decimals)}
            </p>
          </div>
          <button className="btn btn-icon shrink-0" onClick={onClose} aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="eticket-body scrollbar">
          {/* Qué sale y qué entra — se deriva del tipo de operación */}
          <section className="eticket-section">
            <span className="label">Movimiento</span>
            <div className="flujo mt-2">
              <FlujoLado dir="entregamos"
                         moneda={entregamos?.moneda ?? ''}
                         monto={entregamos?.monto ?? 0} />
              <FlujoLado dir="recibimos"
                         moneda={recibimos?.moneda ?? ''}
                         monto={recibimos?.monto ?? 0} />
            </div>

            {cliente && (
              <div className="flex items-center gap-2 mt-3 pt-3 text-small"
                   style={{ borderTop: '1px solid var(--border)', color: 'var(--warm-gray-2)' }}>
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate">{cliente.nombre}</span>
                <span className="mono caption" style={{ color: 'var(--warm-gray-3)' }}>
                  {cliente.doc}
                </span>
              </div>
            )}
          </section>

          {/* Estado de armado / ejecución */}
          <section className="eticket-section">
            {isAdmin ? (
              <div className={`eticket-balance ${resumen.listoParaCadete ? 'is-ok' : 'is-warn'}`}>
                {resumen.listoParaCadete ? (
                  <><Check className="w-4 h-4 shrink-0" />
                    <span>E-ticket completo, listo para el cadete</span></>
                ) : (
                  <><AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Faltan datos en {resumen.incompletas}{' '}
                      {resumen.incompletas === 1 ? 'tramo' : 'tramos'}
                    </span></>
                )}
              </div>
            ) : (
              <div className={`eticket-balance ${resumen.completo ? 'is-ok' : 'is-warn'}`}>
                {resumen.completo ? (
                  <><Check className="w-4 h-4 shrink-0" />
                    <span>Todo entregado y confirmado</span></>
                ) : (
                  <><Clock className="w-4 h-4 shrink-0" />
                    <span>
                      Te quedan {resumen.pendientes} de {resumen.total}{' '}
                      {resumen.total === 1 ? 'tramo' : 'tramos'} por hacer
                    </span></>
                )}
              </div>
            )}

            {(isAdmin || op.instrucciones) && (
              <div className="mt-3">
                <span className="label">Instrucciones</span>
                {isAdmin ? (
                  <textarea
                    className="textarea mt-2"
                    rows={2}
                    placeholder="Indicaciones generales para el cadete…"
                    value={op.instrucciones}
                    onChange={(e) =>
                      dispatch({ type: 'SET_INSTRUCCIONES', opId: op.id, texto: e.target.value })}
                  />
                ) : (
                  <p className="m-0 mt-2 text-[14px]">{op.instrucciones}</p>
                )}
              </div>
            )}
          </section>

          {/* Los dos tramos */}
          <section className="eticket-section">
            <span className="label">Tramos del ticket</span>
            <ul className="list-none p-0 m-0 mt-2.5 flex flex-col gap-2.5">
              {op.patas.map((p) => (
                <PataCard key={p.id} pata={p} op={op}
                          cuentas={cliente?.cuentas ?? []} isAdmin={isAdmin} />
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>,
    document.body
  );
}

/* =============================================================
   Un lado del intercambio
   ============================================================= */

function FlujoLado({ dir, moneda, monto }: {
  dir: 'entregamos' | 'recibimos'; moneda: string; monto: number;
}) {
  const sale = dir === 'entregamos';
  const Icon = sale ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className="flujo-lado" data-dir={dir}>
      <span className="flujo-label">
        <Icon className="w-3.5 h-3.5" />
        {sale ? 'Entregamos' : 'Recibimos'}
      </span>
      <span className="flujo-monto tabular" title={`${fmt(monto, digitsFor(moneda))} ${moneda}`}>
        <span className="hidden sm:inline">{fmt(monto, digitsFor(moneda))}</span>
        <span className="sm:hidden">{fmtCompact(monto)}</span>
      </span>
      <span className="flujo-moneda">{moneda}</span>
    </div>
  );
}

/* =============================================================
   Tarjeta de un tramo — los campos dependen del método
   ============================================================= */

function PataCard({
  pata, op, cuentas, isAdmin,
}: {
  pata: Pata;
  op: Operation;
  cuentas: NonNullable<ReturnType<typeof clienteById>>['cuentas'];
  isAdmin: boolean;
}) {
  const { dispatch } = useCaja();
  const fileRef = useRef<HTMLInputElement>(null);
  const faltan = camposFaltantes(pata);

  const patch = (p: Partial<Pata>) =>
    dispatch({ type: 'EDIT_PATA', opId: op.id, pataId: pata.id, patch: p });

  const onPickCuenta = (cuentaId: string) => {
    const c = cuentas?.find((x) => x.id === cuentaId);
    patch({ cuentaId, banco: c?.banco ?? '', alias: c?.alias ?? '' });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      dispatch({
        type: 'SET_COMPROBANTE',
        opId: op.id,
        pataId: pata.id,
        comprobante: {
          nombre: file.name,
          dataUrl: typeof reader.result === 'string' ? reader.result : '',
          subidoEl: new Date().toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', hour12: false,
          }),
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const sale = pata.direccion === 'entregamos';
  const Icon = METODO_ICON[pata.metodo];
  const dg = digitsFor(pata.moneda);

  return (
    <li className="pata" data-dir={pata.direccion}>
      {/* Cabecera: dirección + monto + estado */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="pata-dir" data-dir={pata.direccion}>
            {sale ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {sale ? 'Entregamos' : 'Recibimos'}
          </span>
          <p className="m-0 mt-1 text-[17px] font-bold tabular">
            {fmt(pata.monto, dg)}
            <span className="text-[12px] font-medium ml-1" style={{ color: 'var(--warm-gray-3)' }}>
              {pata.moneda}
            </span>
          </p>
        </div>

        <span className={`badge ${estadoPataClass[pata.estado]} shrink-0`}>
          {estadoPataLabel[pata.estado]}
        </span>
      </div>

      {/* Método — define qué campos se piden abajo */}
      <div className="mt-2.5">
        {isAdmin ? (
          <div className="metodo-switch" role="group" aria-label="Método">
            {(['efectivo', 'deposito', 'saldo'] as MetodoPata[]).map((m) => {
              const MIcon = METODO_ICON[m];
              return (
                <button key={m} type="button" className="metodo-opt"
                        data-active={String(pata.metodo === m)}
                        onClick={() => patch({ metodo: m })}>
                  <MIcon className="w-3.5 h-3.5" />
                  {m === 'efectivo' ? 'Efectivo' : m === 'deposito' ? 'Banco' : 'Saldo'}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-small font-medium">
            <Icon className="w-4 h-4" style={{ color: 'var(--blue)' }} />
            {METODO_LABEL[pata.metodo]}
          </span>
        )}
      </div>

      {/* ── Campos según el método ── */}

      {pata.metodo === 'deposito' && (
        <div className="pata-campos">
          {isAdmin ? (
            cuentas && cuentas.length > 0 ? (
              <label className="campo">
                <span className="campo-label">Cuenta destino</span>
                <select className="select select-sm" value={pata.cuentaId ?? ''}
                        onChange={(e) => onPickCuenta(e.target.value)}>
                  <option value="">Elegir cuenta…</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>{c.banco} · {c.alias}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="campo">
                <span className="campo-label">Banco / alias</span>
                <input className="input input-sm" placeholder="Banco y alias"
                       value={pata.banco ?? ''}
                       onChange={(e) => patch({ banco: e.target.value })} />
              </label>
            )
          ) : (
            <DatoLinea icon={<Building2 className="w-4 h-4" />}
                       label={pata.banco || 'Sin banco'} sub={pata.alias} mono />
          )}
        </div>
      )}

      {pata.metodo === 'efectivo' && (
        <div className="pata-campos">
          {isAdmin ? (
            <>
              <label className="campo">
                <span className="campo-label">Dirección de entrega</span>
                <input className="input input-sm" placeholder="Calle, número, piso"
                       value={pata.direccionEntrega ?? ''}
                       onChange={(e) => patch({ direccionEntrega: e.target.value })} />
              </label>
              <div className="campo-fila">
                <label className="campo">
                  <span className="campo-label">Quién recibe</span>
                  <input className="input input-sm" placeholder="Nombre"
                         value={pata.nombreRecibe ?? ''}
                         onChange={(e) => patch({ nombreRecibe: e.target.value })} />
                </label>
                <label className="campo">
                  <span className="campo-label">Teléfono</span>
                  <input className="input input-sm" placeholder="11 …" inputMode="tel"
                         value={pata.telefono ?? ''}
                         onChange={(e) => patch({ telefono: e.target.value })} />
                </label>
              </div>
              <label className="campo">
                <span className="campo-label">Horario</span>
                <input className="input input-sm" placeholder="Ej: 13:00 a 15:00"
                       value={pata.horario ?? ''}
                       onChange={(e) => patch({ horario: e.target.value })} />
              </label>
            </>
          ) : (
            <>
              <DatoLinea icon={<MapPin className="w-4 h-4" />}
                         label={pata.direccionEntrega || 'Sin dirección'}
                         sub={pata.horario ? `Horario: ${pata.horario}` : undefined} />
              <DatoLinea icon={<User className="w-4 h-4" />}
                         label={pata.nombreRecibe || 'Sin contacto'} />
              {pata.telefono && (
                <a className="dato dato-link" href={`tel:${pata.telefono.replace(/\s/g, '')}`}>
                  <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--blue)' }} />
                  <span className="mono text-[14px]">{pata.telefono}</span>
                </a>
              )}
            </>
          )}
        </div>
      )}

      {pata.metodo === 'saldo' && (
        <p className="m-0 mt-2.5 text-small px-2.5 py-2"
           style={{ background: 'var(--glass-bg-thin)', borderRadius: 'var(--radius-xs)',
                    color: 'var(--warm-gray-2)' }}>
          Se salda contra la cuenta corriente del cliente. El cadete no interviene.
        </p>
      )}

      {/* Nota */}
      {isAdmin ? (
        <input className="input input-sm mt-2" placeholder="Nota para el cadete (opcional)"
               value={pata.nota}
               onChange={(e) => patch({ nota: e.target.value })} />
      ) : pata.nota ? (
        <p className="m-0 mt-2 text-small px-2.5 py-2"
           style={{ background: 'var(--warning-subtle)', borderRadius: 'var(--radius-xs)' }}>
          {pata.nota}
        </p>
      ) : null}

      {/* Aviso de datos faltantes (sólo admin) */}
      {isAdmin && faltan.length > 0 && (
        <p className="m-0 mt-2 caption flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Falta: {faltan.join(', ')}
        </p>
      )}

      {/* Comprobante — no aplica a saldo */}
      {pata.metodo !== 'saldo' && (
        <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          {pata.comprobante ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0 text-small">
                <FileCheck2 className="w-4 h-4 shrink-0" style={{ color: 'var(--success)' }} />
                <span className="truncate">{pata.comprobante.nombre}</span>
                <span className="caption shrink-0" style={{ color: 'var(--warm-gray-3)' }}>
                  {pata.comprobante.subidoEl}
                </span>
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && pata.estado !== 'confirmado' && (
                  <button className="btn btn-sm btn-secondary"
                          onClick={() => dispatch({ type: 'CONFIRMAR_PATA', opId: op.id, pataId: pata.id })}>
                    <Check className="w-3.5 h-3.5" />
                    Confirmar
                  </button>
                )}
                {!isAdmin && (
                  <button className="btn btn-icon" onClick={() => fileRef.current?.click()}
                          title="Reemplazar comprobante">
                    <Upload className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : !isAdmin ? (
            <button className="btn btn-primary btn-sm btn-full" onClick={() => fileRef.current?.click()}>
              <Paperclip className="w-4 h-4" />
              {pata.metodo === 'efectivo' ? 'Subir remito firmado' : 'Subir comprobante'}
            </button>
          ) : (
            <span className="text-small flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
              <Clock className="w-3.5 h-3.5" />
              Esperando comprobante del cadete
            </span>
          )}

          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
        </div>
      )}
    </li>
  );
}

function DatoLinea({ icon, label, sub, mono = false }: {
  icon: React.ReactNode; label: string; sub?: string; mono?: boolean;
}) {
  return (
    <div className="dato">
      <span className="shrink-0" style={{ color: 'var(--warm-gray-3)' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium truncate">{label}</span>
        {sub && (
          <span className={`block caption truncate ${mono ? 'mono' : ''}`}
                style={{ color: 'var(--warm-gray-3)' }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
