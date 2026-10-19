'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Check, ChevronRight, Clock, Copy, MapPin, Phone, User } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { TIPO_CUENTA_LABEL } from '@/lib/customers';
import { eticketsApi, fmtMonto, METODO_ENTREGA_LABEL, type EticketCadete } from '@/lib/etickets';

/**
 * C5 — E-tickets del cadete, desde la API (GET /e-tickets con su token).
 *
 * El backend decide qué ve el cadete (lista blanca `ETICKET_CADETE_SELECT`,
 * regla 4): la visita y, por tramo, cuánto deja, cuánto se lleva y a qué
 * cuenta deposita. Nunca cotización, comisión, spread ni ganancia. Esta
 * pantalla sólo muestra lo que llega; los montos se formatean, no se calculan.
 */

type TramoCadete = EticketCadete['tramos'][number];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<EticketCadete[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setTickets((await eticketsApi.listCadete()).data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude cargar los e-tickets');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  if (abierto) {
    return <DetalleTicket id={abierto} onVolver={() => { setAbierto(null); void cargar(); }} />;
  }

  return (
    <div className="page animate-in">
      <header>
        <h1>E-Tickets</h1>
        <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
          Entregas pendientes — bolsa común
        </p>
      </header>

      {error && (
        <div className="card p-3" style={{ borderColor: 'var(--danger)' }} role="alert">
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="card p-4 animate-pulse" style={{ height: 76 }} />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="m-0 text-[14px]" style={{ color: 'var(--warm-gray-3)' }}>No hay entregas pendientes</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => {
            const dejas = t.tramos.filter((x) => x.sentido === 'ENTREGA');
            return (
              <button key={t.id} className="card p-4 flex items-center gap-3 text-left w-full" onClick={() => setAbierto(t.id)}>
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-2 flex-wrap">
                    <span className="mono text-[13px] font-bold" style={{ color: 'var(--blue)' }}>{t.codigo}</span>
                    <span className="badge">{METODO_ENTREGA_LABEL[t.metodoEntrega] ?? t.metodoEntrega}</span>
                  </p>
                  <p className="m-0 mt-1 text-[14px] font-medium truncate">
                    {dejas.length ? `Dejás ${dejas.map((x) => fmtMonto(x.monto, x.moneda)).join(' + ')}` : 'Sólo retiro'}
                  </p>
                  <p className="m-0 caption truncate" style={{ color: 'var(--warm-gray-3)' }}>
                    {t.direccionEntrega ?? 'Sin visita: sólo depósito'}{t.horarioEntrega ? ` · ${t.horarioEntrega}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--warm-gray-3)' }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetalleTicket({ id, onVolver }: { id: string; onVolver: () => void }) {
  const [t, setT] = useState<EticketCadete | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    eticketsApi.getCadete(id).then(setT).catch((e) =>
      setError(e instanceof ApiError ? e.message : 'No pude cargar el e-ticket'));
  }, [id]);

  async function confirmar() {
    setConfirmando(true);
    setError(null);
    try {
      await eticketsApi.confirm(id);
      onVolver();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude confirmar la entrega');
      setConfirmando(false);
    }
  }

  const dejas = t?.tramos.filter((x) => x.sentido === 'ENTREGA') ?? [];
  const llevas = t?.tramos.filter((x) => x.sentido === 'RETIRO') ?? [];

  return (
    <div className="page animate-in">
      <button className="inline-flex items-center gap-1.5 text-small w-fit" style={{ color: 'var(--warm-gray-2)' }} onClick={onVolver}>
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {error && (
        <div className="card p-3" style={{ borderColor: 'var(--danger)' }} role="alert">
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {!t ? (
        !error && <div className="card p-4 animate-pulse" style={{ height: 160 }} />
      ) : (
        <>
          <header>
            <span className="mono text-[13px] font-bold" style={{ color: 'var(--blue)' }}>{t.codigo}</span>
            <h1 className="mt-1">{METODO_ENTREGA_LABEL[t.metodoEntrega] ?? 'Entrega'}</h1>
          </header>

          {dejas.length > 0 && (
            <section aria-label="Dejás" className="flex flex-col gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Dejás</h2>
              {dejas.map((x) => <TramoDejas key={x.orden} x={x} />)}
            </section>
          )}

          {/* Si no hay retiros, el bloque no existe (ni vacío ni en 0). */}
          {llevas.length > 0 && (
            <section aria-label="Te llevás" className="flex flex-col gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Te llevás</h2>
              {llevas.map((x) => (
                <div key={x.orden} className="card p-4">
                  <p className="m-0 text-[22px] font-bold tabular">{fmtMonto(x.monto, x.moneda)}</p>
                  <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>En efectivo</p>
                </div>
              ))}
            </section>
          )}

          {t.direccionEntrega && (
            <section aria-label="Visita" className="card p-4 flex flex-col gap-2">
              <Dato icon={<MapPin className="w-4 h-4" />} texto={t.direccionEntrega} sub={t.horarioEntrega ? `Horario: ${t.horarioEntrega}` : undefined} />
              {t.nombreRecibe && <Dato icon={<User className="w-4 h-4" />} texto={t.nombreRecibe} />}
              {t.telefonoContacto && (
                <a className="flex items-center gap-2 no-underline" href={`tel:${t.telefonoContacto.replace(/\s/g, '')}`}>
                  <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--blue)' }} />
                  <span className="mono text-[14px]">{t.telefonoContacto}</span>
                </a>
              )}
            </section>
          )}

          {t.instrucciones && (
            <p className="m-0 text-small px-3 py-2.5" style={{ background: 'var(--warning-subtle)', borderRadius: 'var(--radius-xs)' }}>
              {t.instrucciones}
            </p>
          )}

          {t.estado === 'pendiente' ? (
            <button className="btn btn-primary btn-full" disabled={confirmando} onClick={() => void confirmar()}>
              <Check className="w-4 h-4" /> {confirmando ? 'Confirmando…' : 'Marcar como entregado'}
            </button>
          ) : (
            <p className="m-0 caption flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
              <Clock className="w-3.5 h-3.5" /> Estado: {t.estado}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TramoDejas({ x }: { x: TramoCadete }) {
  if (x.canal === 'EFECTIVO') {
    return (
      <div className="card p-4">
        <p className="m-0 text-[22px] font-bold tabular">{fmtMonto(x.monto, x.moneda)}</p>
        <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>En efectivo</p>
      </div>
    );
  }
  // Depósito: número y tipo de cuenta son lo más destacado (#5).
  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="m-0 text-[22px] font-bold tabular">{fmtMonto(x.monto, x.moneda)}</p>
      <p className="m-0 caption flex items-center gap-1.5" style={{ color: 'var(--warm-gray-3)' }}>
        <Building2 className="w-3.5 h-3.5" /> Depositás en
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[18px] font-semibold mono break-all">{x.depNumeroCuenta ?? x.depCbu ?? x.depAlias ?? '—'}</p>
          <p className="m-0 text-[14px] font-medium">
            {x.depTipoCuenta ? TIPO_CUENTA_LABEL[x.depTipoCuenta] : 'Cuenta'}{x.depMonedaCuenta ? ` en ${x.depMonedaCuenta}` : ''}
          </p>
        </div>
        {x.depNumeroCuenta && <Copiar valor={x.depNumeroCuenta} etiqueta="número de cuenta" />}
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 items-center text-small">
        {x.depBeneficiario && <><dt style={{ color: 'var(--warm-gray-3)' }}>Titular</dt><dd className="m-0">{x.depBeneficiario}</dd><span /></>}
        {x.depCuit && <><dt style={{ color: 'var(--warm-gray-3)' }}>CUIT</dt><dd className="m-0 mono">{x.depCuit}</dd><span /></>}
        {x.depBanco && <><dt style={{ color: 'var(--warm-gray-3)' }}>Banco</dt><dd className="m-0">{x.depBanco}</dd><span /></>}
        {x.depCbu && <><dt style={{ color: 'var(--warm-gray-3)' }}>CBU</dt><dd className="m-0 mono break-all">{x.depCbu}</dd><Copiar valor={x.depCbu} etiqueta="CBU" /></>}
        {x.depAlias && <><dt style={{ color: 'var(--warm-gray-3)' }}>Alias</dt><dd className="m-0 mono">{x.depAlias}</dd><span /></>}
      </dl>
    </div>
  );
}

function Copiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn btn-icon shrink-0"
      aria-label={`Copiar ${etiqueta}`}
      onClick={() => { void navigator.clipboard?.writeText(valor); setOk(true); setTimeout(() => setOk(false), 1500); }}
    >
      {ok ? <Check className="w-4 h-4" style={{ color: 'var(--success)' }} /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Dato({ icon, texto, sub }: { icon: React.ReactNode; texto: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--warm-gray-3)' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">{texto}</span>
        {sub && <span className="block caption" style={{ color: 'var(--warm-gray-3)' }}>{sub}</span>}
      </span>
    </div>
  );
}
