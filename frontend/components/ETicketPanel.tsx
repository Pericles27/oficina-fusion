'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, AlertTriangle, Clock, ArrowUpRight, ArrowDownLeft, ArrowUp, ArrowDown,
  Banknote, Building2, MapPin, Plus, Trash2,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import { patasDe, OP_STATUS_LABEL, type Operation, type Par } from '@/lib/caja-store';
import { customersApi, resumenCuenta, TIPO_CUENTA_LABEL, type CuentaCliente } from '@/lib/customers';
import {
  eticketsApi, fmtMonto, DEP_KEYS, ESTADO_LABEL, METODO_ENTREGA_LABEL, SENTIDO_LABEL,
  type DepKey, type DepSnapshot, type EticketAdmin, type TramoCanal, type TramoInput, type TramoSentido,
} from '@/lib/etickets';

/* =============================================================
   C4 — E-ticket del admin: UNA visita + N tramos (U4, #2).

   - Visita (dirección, contacto, horario): una sola vez por e-ticket,
     y sólo si hay algún tramo en efectivo.
   - Tramos: sentido (dejar / retirar), canal, moneda y monto. El
     depósito sólo existe al DEJAR (retirar por depósito espera U6).
   - Se guarda con POST/PUT /e-tickets (contrato de C2): cada tramo
     viaja con su `id`; los datos de la cuenta los copia el backend y
     un ajuste manual viaja sólo en `depOverrides`.
   - Los montos son strings; la suma contra la operación no se controla
     hasta que Nicolás responda U7.
   ============================================================= */

const MONEDAS = ['ARS', 'USD', 'EUR', 'GBP', 'BRL', 'USDT'];

const DEP_LABEL: Record<DepKey, string> = {
  depBeneficiario: 'Beneficiario',
  depCuit: 'CUIT',
  depBanco: 'Banco',
  depTipoCuenta: 'Tipo de cuenta',
  depMonedaCuenta: 'Moneda de la cuenta',
  depNumeroCuenta: 'Número de cuenta',
  depCbu: 'CBU',
  depAlias: 'Alias',
};
// Tipo y moneda de la cuenta se corrigen en la cuenta del cliente, no a mano.
const DEP_EDITABLES: DepKey[] = ['depBeneficiario', 'depCuit', 'depBanco', 'depNumeroCuenta', 'depCbu', 'depAlias'];

interface TramoDraft {
  key: string;
  id?: string;
  sentido: TramoSentido;
  canal: TramoCanal;
  moneda: string;
  monto: string;
  cuentaDestinoId: string | null;
  /** Cuenta y snapshot tal como están guardados (null si es un alta). */
  guardado: { cuentaDestinoId: string | null; dep: DepSnapshot } | null;
  /** Ajustes manuales pendientes de guardar: sólo las claves tocadas. */
  overrides: Partial<Record<DepKey, string>>;
}

interface VisitaDraft {
  direccionEntrega: string;
  telefonoContacto: string;
  nombreRecibe: string;
  horarioEntrega: string;
  instrucciones: string;
}

const nuevaKey = () => Math.random().toString(36).slice(2, 10);

function draftsDe(e: EticketAdmin): TramoDraft[] {
  return e.tramos.map((t) => ({
    key: t.id, id: t.id, sentido: t.sentido, canal: t.canal, moneda: t.moneda, monto: t.monto,
    cuentaDestinoId: t.cuentaDestinoId,
    guardado: {
      cuentaDestinoId: t.cuentaDestinoId,
      dep: Object.fromEntries(DEP_KEYS.map((k) => [k, t[k]])) as unknown as DepSnapshot,
    },
    overrides: {},
  }));
}

function visitaDe(e: EticketAdmin | null): VisitaDraft {
  return {
    direccionEntrega: e?.direccionEntrega ?? '',
    telefonoContacto: e?.telefonoContacto ?? '',
    nombreRecibe: e?.nombreRecibe ?? '',
    horarioEntrega: e?.horarioEntrega ?? '',
    instrucciones: e?.instrucciones ?? '',
  };
}

/** Ayuda de carga: lo que la caja deja y lo que se lleva según la operación. */
function sugerencia(op: Operation, par: Par): TramoDraft[] {
  const p = patasDe(op, par);
  const base = { canal: 'EFECTIVO' as TramoCanal, cuentaDestinoId: null, guardado: null, overrides: {} };
  return [
    { ...base, key: nuevaKey(), sentido: 'ENTREGA', moneda: p.entregamos.moneda, monto: p.entregamos.monto },
    { ...base, key: nuevaKey(), sentido: 'RETIRO', moneda: p.recibimos.moneda, monto: p.recibimos.monto },
  ];
}

export function ETicketPanel({ op, parDef, onClose }: {
  op: Operation;
  parDef: Par;
  onClose: () => void;
}) {
  const [eticket, setEticket] = useState<EticketAdmin | null>(null);
  const [cuentas, setCuentas] = useState<CuentaCliente[]>([]);
  const [tramos, setTramos] = useState<TramoDraft[]>([]);
  const [visita, setVisita] = useState<VisitaDraft>(visitaDe(null));
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [e, cs] = await Promise.all([
        eticketsApi.byOperation(op.id),
        op.clienteId ? customersApi.accounts(op.clienteId) : Promise.resolve([]),
      ]);
      setEticket(e);
      setCuentas(cs.filter((c) => c.activo));
      setTramos(e ? draftsDe(e) : sugerencia(op, parDef));
      setVisita(visitaDe(e));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pude cargar el e-ticket');
    } finally {
      setCargando(false);
    }
  }, [op, parDef]);

  useEffect(() => { void cargar(); }, [cargar]);

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

  const hayEfectivo = tramos.some((t) => t.canal === 'EFECTIVO');
  const editable = !eticket || eticket.estado === 'pendiente';

  const patch = (key: string, p: Partial<TramoDraft>) =>
    setTramos((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t)));

  const mover = (i: number, delta: number) =>
    setTramos((ts) => {
      const j = i + delta;
      if (j < 0 || j >= ts.length) return ts;
      const copia = [...ts];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const agregar = () =>
    setTramos((ts) => [...ts, {
      key: nuevaKey(), sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: parDef.quote, monto: '',
      cuentaDestinoId: null, guardado: null, overrides: {},
    }]);

  const payloadTramos = useMemo<TramoInput[]>(() => tramos.map((t, i) => {
    const input: TramoInput = {
      ...(t.id ? { id: t.id } : {}),
      orden: i + 1,
      sentido: t.sentido,
      canal: t.canal,
      moneda: t.moneda,
      monto: t.monto.trim().replace(',', '.'),
    };
    if (t.canal === 'DEPOSITO') {
      input.cuentaDestinoId = t.cuentaDestinoId;
      const keys = Object.keys(t.overrides) as DepKey[];
      if (keys.length) {
        input.depOverrides = Object.fromEntries(keys.map((k) => [k, t.overrides[k]?.trim() || null]));
      }
    }
    return input;
  }), [tramos]);

  async function guardar() {
    if (!op.clienteId) return;
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    const cabecera = {
      // Sin efectivo "la dirección de envío no aplica" (#2): se manda vacía.
      direccionEntrega: hayEfectivo ? visita.direccionEntrega.trim() || null : null,
      telefonoContacto: hayEfectivo ? visita.telefonoContacto.trim() || null : null,
      nombreRecibe: hayEfectivo ? visita.nombreRecibe.trim() || null : null,
      horarioEntrega: hayEfectivo ? visita.horarioEntrega.trim() || null : null,
      instrucciones: visita.instrucciones.trim() || null,
    };
    try {
      const guardado = eticket
        ? await eticketsApi.update(eticket.id, { ...cabecera, tramos: payloadTramos })
        : await eticketsApi.create({ ...cabecera, clienteId: op.clienteId, operationId: op.id, tramos: payloadTramos });
      setEticket(guardado);
      setTramos(draftsDe(guardado));
      setVisita(visitaDe(guardado));
      setGuardadoOk(true);
    } catch (err) {
      // El backend es la fuente de las reglas: su mensaje se muestra tal cual.
      setError(err instanceof ApiError ? err.message : 'No pude guardar el e-ticket');
    } finally {
      setGuardando(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="eticket-backdrop" onClick={onClose} aria-hidden />

      <aside className="eticket" role="dialog" aria-label={`E-Ticket ${op.codigo}`}>
        <header className="eticket-head">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-[13px] font-bold" style={{ color: 'var(--blue)' }}>{op.codigo}</span>
              <span className={`badge ${op.tipo === 'C' ? 'badge-success' : 'badge-info'}`}>
                {op.tipo === 'C' ? 'Compra' : 'Venta'}
              </span>
              <span className="badge badge-warning">{OP_STATUS_LABEL[op.status]}</span>
              {eticket && (
                <span className="badge">
                  {eticket.codigo} · {ESTADO_LABEL[eticket.estado]} · {METODO_ENTREGA_LABEL[eticket.metodoEntrega] ?? eticket.metodoEntrega}
                </span>
              )}
            </div>
            <h2 className="heading-2 mt-1.5 truncate">{op.cliente || 'Sin cliente'}</h2>
            <p className="m-0 caption flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
              <Clock className="w-3.5 h-3.5" />
              {op.hora} · {parDef.par} · {fmtMonto(op.monto, parDef.base)} → {fmtMonto(op.contra, parDef.quote)}
            </p>
          </div>
          <button className="btn btn-icon shrink-0" onClick={onClose} aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="eticket-body scrollbar">
          {!op.clienteId ? (
            <section className="eticket-section">
              <div className="eticket-balance is-warn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Asigná un cliente a la operación para armar el e-ticket.</span>
              </div>
            </section>
          ) : cargando ? (
            <section className="eticket-section">
              <div className="card p-4 animate-pulse" style={{ height: 120 }} />
            </section>
          ) : (
            <>
              {!eticket && (
                <section className="eticket-section">
                  <div className="eticket-balance is-warn">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Todavía no hay e-ticket. Los tramos de abajo son una sugerencia según la operación.</span>
                  </div>
                </section>
              )}
              {!editable && (
                <section className="eticket-section">
                  <div className="eticket-balance is-ok">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>E-ticket {ESTADO_LABEL[eticket!.estado].toLowerCase()}: ya no se puede editar.</span>
                  </div>
                </section>
              )}

              {/* Visita: una sola vez por e-ticket, sólo si hay efectivo */}
              {hayEfectivo && (
                <section className="eticket-section" aria-label="Visita">
                  <span className="label flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Visita</span>
                  <div className="pata-campos">
                    <label className="campo">
                      <span className="campo-label">Dirección de entrega</span>
                      <input className="input input-sm" placeholder="Calle, número, piso" disabled={!editable}
                             value={visita.direccionEntrega}
                             onChange={(e) => setVisita({ ...visita, direccionEntrega: e.target.value })} />
                    </label>
                    <div className="campo-fila">
                      <label className="campo">
                        <span className="campo-label">Quién recibe</span>
                        <input className="input input-sm" disabled={!editable} value={visita.nombreRecibe}
                               onChange={(e) => setVisita({ ...visita, nombreRecibe: e.target.value })} />
                      </label>
                      <label className="campo">
                        <span className="campo-label">Teléfono</span>
                        <input className="input input-sm" inputMode="tel" disabled={!editable} value={visita.telefonoContacto}
                               onChange={(e) => setVisita({ ...visita, telefonoContacto: e.target.value })} />
                      </label>
                    </div>
                    <label className="campo">
                      <span className="campo-label">Horario</span>
                      <input className="input input-sm" placeholder="Ej: 13:00 a 15:00" disabled={!editable}
                             value={visita.horarioEntrega}
                             onChange={(e) => setVisita({ ...visita, horarioEntrega: e.target.value })} />
                    </label>
                  </div>
                </section>
              )}

              {/* Tramos */}
              <section className="eticket-section" aria-label="Tramos">
                <div className="flex items-center justify-between">
                  <span className="label">Tramos</span>
                  {editable && (
                    <button className="btn btn-ghost btn-sm" onClick={agregar}><Plus className="w-3.5 h-3.5" /> Agregar tramo</button>
                  )}
                </div>
                <ul className="list-none p-0 m-0 mt-2.5 flex flex-col gap-2.5">
                  {tramos.map((t, i) => (
                    <TramoEditor
                      key={t.key} t={t} i={i} total={tramos.length} cuentas={cuentas} editable={editable}
                      onPatch={(p) => patch(t.key, p)}
                      onMover={(d) => mover(i, d)}
                      onQuitar={() => setTramos((ts) => ts.filter((x) => x.key !== t.key))}
                    />
                  ))}
                </ul>
              </section>

              <section className="eticket-section">
                <label className="campo">
                  <span className="label">Instrucciones para el cadete</span>
                  <textarea className="textarea mt-2" rows={2} disabled={!editable}
                            placeholder="Indicaciones generales…" value={visita.instrucciones}
                            onChange={(e) => setVisita({ ...visita, instrucciones: e.target.value })} />
                </label>
              </section>

              {editable && (
                <section className="eticket-section flex flex-col gap-2">
                  {error && (
                    <div className="eticket-balance is-warn" role="alert">
                      <AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span>
                    </div>
                  )}
                  {guardadoOk && !error && (
                    <div className="eticket-balance is-ok" role="status">
                      <Check className="w-4 h-4 shrink-0" /><span>E-ticket guardado</span>
                    </div>
                  )}
                  <button className="btn btn-primary btn-full" disabled={guardando || tramos.length === 0} onClick={() => void guardar()}>
                    {guardando ? 'Guardando…' : eticket ? 'Guardar cambios' : 'Crear e-ticket'}
                  </button>
                </section>
              )}
              {!editable && error && (
                <section className="eticket-section"><p className="m-0 text-small" style={{ color: 'var(--danger)' }}>{error}</p></section>
              )}
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

function TramoEditor({ t, i, total, cuentas, editable, onPatch, onMover, onQuitar }: {
  t: TramoDraft;
  i: number;
  total: number;
  cuentas: CuentaCliente[];
  editable: boolean;
  onPatch: (p: Partial<TramoDraft>) => void;
  onMover: (delta: number) => void;
  onQuitar: () => void;
}) {
  const dir = t.sentido === 'ENTREGA' ? 'entregamos' : 'recibimos';
  // Snapshot visible: el guardado si la cuenta no cambió; si cambió, el backend
  // copiará la cuenta nueva al guardar (los ajustes anteriores no se arrastran).
  const mismaCuenta = t.guardado?.cuentaDestinoId === t.cuentaDestinoId;
  const cuentaElegida = cuentas.find((c) => c.id === t.cuentaDestinoId);
  const base: Partial<DepSnapshot> = mismaCuenta && t.guardado
    ? t.guardado.dep
    : cuentaElegida
      ? {
          depBeneficiario: cuentaElegida.titular, depCuit: cuentaElegida.cuitTitular, depBanco: cuentaElegida.banco,
          depTipoCuenta: cuentaElegida.tipoCuenta, depMonedaCuenta: cuentaElegida.monedaCuenta,
          depNumeroCuenta: cuentaElegida.numeroCuenta, depCbu: cuentaElegida.cbu, depAlias: cuentaElegida.alias,
        }
      : {};
  const cambioCuenta = !!t.guardado && t.guardado.cuentaDestinoId !== null && !mismaCuenta;

  const setSentido = (sentido: TramoSentido) =>
    // Retirar por depósito no existe hasta U6: al pasar a retiro, vuelve a efectivo.
    onPatch(sentido === 'RETIRO' && t.canal === 'DEPOSITO'
      ? { sentido, canal: 'EFECTIVO', cuentaDestinoId: null, overrides: {} }
      : { sentido });

  const setCanal = (canal: TramoCanal) =>
    onPatch(canal === 'EFECTIVO' ? { canal, cuentaDestinoId: null, overrides: {} } : { canal });

  const valor = (k: DepKey) => (k in t.overrides ? t.overrides[k] ?? '' : (base[k] as string | null) ?? '');

  return (
    <li className="pata" data-dir={dir} aria-label={`Tramo ${i + 1}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="pata-dir" data-dir={dir}>
          {t.sentido === 'ENTREGA' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
          Tramo {i + 1}
        </span>
        {editable && (
          <span className="flex items-center gap-0.5">
            <button className="btn btn-icon" aria-label="Subir tramo" disabled={i === 0} onClick={() => onMover(-1)}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button className="btn btn-icon" aria-label="Bajar tramo" disabled={i === total - 1} onClick={() => onMover(1)}><ArrowDown className="w-3.5 h-3.5" /></button>
            <button className="btn btn-icon" aria-label="Quitar tramo" onClick={onQuitar}><Trash2 className="w-3.5 h-3.5" /></button>
          </span>
        )}
      </div>

      <div className="metodo-switch mt-2" role="group" aria-label="Sentido">
        {(['ENTREGA', 'RETIRO'] as TramoSentido[]).map((s) => (
          <button key={s} type="button" className="metodo-opt" disabled={!editable}
                  data-active={String(t.sentido === s)} onClick={() => setSentido(s)}>
            {SENTIDO_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="metodo-switch mt-2" role="group" aria-label="Canal">
        <button type="button" className="metodo-opt" disabled={!editable}
                data-active={String(t.canal === 'EFECTIVO')} onClick={() => setCanal('EFECTIVO')}>
          <Banknote className="w-3.5 h-3.5" /> Efectivo
        </button>
        {/* U6: retirar por depósito no se ofrece hasta que Nicolás lo defina. */}
        {t.sentido === 'ENTREGA' && (
          <button type="button" className="metodo-opt" disabled={!editable}
                  data-active={String(t.canal === 'DEPOSITO')} onClick={() => setCanal('DEPOSITO')}>
            <Building2 className="w-3.5 h-3.5" /> Depósito
          </button>
        )}
      </div>

      <div className="campo-fila mt-2">
        <label className="campo">
          <span className="campo-label">Moneda</span>
          <select className="select select-sm" disabled={!editable} value={t.moneda}
                  onChange={(e) => onPatch({ moneda: e.target.value })}>
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="campo">
          <span className="campo-label">Monto</span>
          <input className="input input-sm tabular" inputMode="decimal" disabled={!editable} value={t.monto}
                 onChange={(e) => onPatch({ monto: e.target.value })} />
        </label>
      </div>

      {t.canal === 'DEPOSITO' && (
        <div className="pata-campos">
          <label className="campo">
            <span className="campo-label">Cuenta destino del cliente</span>
            <select className="select select-sm" disabled={!editable} value={t.cuentaDestinoId ?? ''}
                    onChange={(e) => onPatch({ cuentaDestinoId: e.target.value || null, overrides: {} })}>
              <option value="">Elegir cuenta…</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{resumenCuenta(c)}</option>)}
            </select>
          </label>
          {cuentas.length === 0 && (
            <p className="m-0 caption" style={{ color: 'var(--warning)' }}>
              El cliente no tiene cuentas cargadas: agregalas en Clientes.
            </p>
          )}
          {cambioCuenta && (
            <p className="m-0 caption" style={{ color: 'var(--warning)' }}>
              Cambiaste la cuenta: al guardar se copian los datos de la cuenta nueva y se descartan los ajustes anteriores.
            </p>
          )}
          {t.cuentaDestinoId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['depTipoCuenta', 'depMonedaCuenta'] as DepKey[]).map((k) => (
                <div key={k} className="campo">
                  <span className="campo-label">{DEP_LABEL[k]}</span>
                  <span className="text-small">
                    {k === 'depTipoCuenta'
                      ? (base.depTipoCuenta ? TIPO_CUENTA_LABEL[base.depTipoCuenta] : '—')
                      : base.depMonedaCuenta ?? '—'}
                  </span>
                </div>
              ))}
              {DEP_EDITABLES.map((k) => (
                <label key={k} className="campo">
                  <span className="campo-label">{DEP_LABEL[k]}{k in t.overrides ? ' (ajustado)' : ''}</span>
                  <input className={`input input-sm${['depCbu', 'depNumeroCuenta', 'depCuit', 'depAlias'].includes(k) ? ' mono' : ''}`}
                         disabled={!editable} value={valor(k)}
                         onChange={(e) => onPatch({ overrides: { ...t.overrides, [k]: e.target.value } })} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
