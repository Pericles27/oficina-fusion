'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle, Copy, Lock, MessageCircle, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import Decimal from 'decimal.js';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCaja } from '@/lib/caja-store';
import { DataList, type DataColumn } from '@/components/DataList';

/**
 * #12 — Cierre diario.
 *
 * 1. Movimientos del día: entradas y salidas por moneda, ganancia y gastos.
 * 2. Saldos reales: cada saldo se carga por su valor en USD; puede haber
 *    varios renglones por moneda (p. ej. euros a distintas cotizaciones).
 * 3. Diferencia entre saldo esperado y real, bien visible.
 * 4. #19: reporte del cierre para mandarle al jefe por WhatsApp (ganancias,
 *    saldo de caja, saldos de clientes y balance).
 *
 * Las cifras del día y el saldo esperado los calcula el backend
 * (GET /closing/preview). La suma de los renglones y la diferencia que se ven
 * mientras se tipea son sólo de vista previa: al guardar, el backend las
 * recalcula con Decimal y ese es el valor que persiste.
 */

const MONEDAS = ['USD', 'ARS', 'EUR', 'GBP', 'BRL', 'USDT'] as const;
type Moneda = (typeof MONEDAS)[number];

interface Movimiento { moneda: string; entradas: string; salidas: string; neto: string }
type GastoTipo = 'OFICINA' | 'JEFE' | 'JEFE_A_DEVOLVER';
interface Gasto { id: string; codigo: string; concepto: string; categoria: string; tipo: GastoTipo; montoUsd: string; montoArs: string | null }
interface MovUsd { id: string; codigo: string; ingresoUsd: string; egresoUsd: string; comisionUsd: string; gananciaUsd: string; notas: string | null }
interface TotalesUsd { ingresoUsd: string; egresoUsd: string; comisionUsd: string; gananciaUsd: string }
interface MovSaldoCliente {
  id: string; clienteNombre: string; enCaja: boolean; tipo: 'credito' | 'debito';
  montoUsd: string; opCodigo: string | null; nota: string | null;
}
interface SaldoClienteReporte { clienteId: string; clienteNombre: string; custodia: string; saldoUsdCierre: string }
interface Reporte {
  fecha: string;
  estado: string;
  gananciaCambioUsd: string;
  gananciaCablesUsd: string;
  gananciaUsdtUsd: string;
  gananciaTotalUsd: string;
  totalGastosUsd: string;
  resultadoOperativoUsd: string;
  cajaContadaUsd: string;
  posicionEsperadaUsd: string;
  diferenciaUsd: string;
  saldosClientes: SaldoClienteReporte[];
  totalSaldosCajaUsd: string;
  totalSaldosSeparadosUsd: string;
  balanceUsd: string;
}
interface Preview {
  fecha: string;
  tcCierre: string;
  nOpsFinalizadas: number;
  nOpsSinFinalizar: number;
  movimientos: Movimiento[];
  gananciaRealizadaUsd: string;
  totalComisionesUsd: string;
  cables: MovUsd[];
  totalCables: TotalesUsd;
  usdt: MovUsd[];
  totalUsdt: TotalesUsd;
  gastos: Gasto[];
  totalGastosArs: string;
  totalGastosUsd: string;
  deudaJefeUsd: string;
  gananciaTotalUsd: string;
  resultadoOperativoUsd: string;
  volumenTotalUsd: string;
  saldoClientes: MovSaldoCliente[];
  saldoClientesNetoCajaUsd: string;
  saldoInicialSugeridoUsd: string | null;
  saldoInicialUsd: string;
  posicionEsperadaUsd: string;
  cierreExistenteId: string | null;
}
interface SaldoRealGuardado { id: string; moneda: Moneda; montoUsd: string; detalle: string | null }
interface Cierre {
  id: string;
  estado: 'borrador' | 'confirmado' | 'reabierto';
  tcCierre: string;
  saldoInicialUsd: string;
  cajaContadaUsd: string;
  posicionEsperadaUsd: string;
  diferenciaUsd: string;
  operadorCierreNombre: string;
  notas: string | null;
  saldosReales: SaldoRealGuardado[];
}
interface Renglon { key: number; moneda: Moneda; montoUsd: string; detalle: string }

const GASTO_TIPO_LABEL: Record<GastoTipo, string> = {
  OFICINA: 'Oficina',
  JEFE: 'Jefe · gasto del día',
  JEFE_A_DEVOLVER: 'Jefe · a devolver',
};

const ESTADO_LABEL: Record<Cierre['estado'], string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  reabierto: 'Reabierto',
};

const errorDe = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const hoyYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Mediodía local sin zona: el backend toma ese día en su hora local (Cierre.fecha es @db.Date). */
const fechaApi = (ymd: string) => `${ymd}T12:00:00`;

const fmt = (v: string | number, digits = 2) =>
  Number(v).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd = (v: string | number) => `US$ ${fmt(v)}`;
const conSigno = (v: string | number) => `${Number(v) > 0 ? '+' : ''}${fmt(v)}`;

/** Acepta coma o punto decimal; devuelve el string canónico o null si no es un número válido ≥ 0. */
function decimalCanonico(texto: string): string | null {
  const t = texto.trim().replace(/\./g, (m, i, s) => (s.includes(',') ? '' : m)).replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

let siguienteKey = 1;
const renglonVacio = (moneda: Moneda = 'USD'): Renglon => ({ key: siguienteKey++, moneda, montoUsd: '', detalle: '' });

export default function ClosingPage() {
  const { user } = useAuth();
  const esAdmin = !!user?.roles.includes('ADMIN');
  const { state } = useCaja();

  const [fecha, setFecha] = useState(hoyYmd);
  const [tcCierre, setTcCierre] = useState('');
  const [saldoInicial, setSaldoInicial] = useState<string | null>(null); // null = usar el sugerido
  const [renglones, setRenglones] = useState<Renglon[]>(() => [renglonVacio()]);
  const [notas, setNotas] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TC de cierre por defecto: venta de USD/ARS.
  const usdArs = state.pares.find((p) => p.par === 'USD/ARS');
  useEffect(() => {
    if (!tcCierre && usdArs) setTcCierre(usdArs.venta);
  }, [usdArs, tcCierre]);

  const tcCanon = decimalCanonico(tcCierre);
  const saldoInicialCanon = saldoInicial === null ? null : decimalCanonico(saldoInicial);

  const cargar = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({ fecha: fechaApi(fecha) });
    if (tcCanon) q.set('tcCierre', tcCanon);
    if (saldoInicialCanon) q.set('saldoInicialUsd', saldoInicialCanon);
    try {
      const p = await api.get<Preview>(`/closing/preview?${q}`);
      setPreview(p);
      setCierre(p.cierreExistenteId ? await api.get<Cierre>(`/closing/${p.cierreExistenteId}`) : null);
    } catch (e) {
      setError(errorDe(e, 'No pude cargar el cierre del día'));
    } finally {
      setCargando(false);
    }
  }, [fecha, tcCanon, saldoInicialCanon]);

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 300);
    return () => clearTimeout(t);
  }, [cargar]);

  // Al cambiar de día, se vuelve a sugerir el saldo inicial y se limpian los renglones.
  useEffect(() => {
    setSaldoInicial(null);
    setRenglones([renglonVacio()]);
    setNotas('');
  }, [fecha]);

  const renglonesValidos = useMemo(() => renglones.filter((r) => r.montoUsd.trim() !== ''), [renglones]);
  const invalidos = renglonesValidos.filter((r) => decimalCanonico(r.montoUsd) === null);

  // Vista previa (ver comentario del archivo): el backend recalcula al guardar.
  const totalReal = useMemo(
    () => renglonesValidos.reduce((acc, r) => acc.plus(decimalCanonico(r.montoUsd) ?? 0), new Decimal(0)),
    [renglonesValidos],
  );
  const subtotales = useMemo(() => {
    const m = new Map<Moneda, Decimal>();
    for (const r of renglonesValidos) {
      const v = decimalCanonico(r.montoUsd);
      if (v) m.set(r.moneda, (m.get(r.moneda) ?? new Decimal(0)).plus(v));
    }
    return MONEDAS.filter((mo) => m.has(mo)).map((mo) => ({ moneda: mo, total: m.get(mo)!.toFixed(2) }));
  }, [renglonesValidos]);

  const esperado = cierre ? cierre.posicionEsperadaUsd : preview?.posicionEsperadaUsd ?? '0';
  const real = cierre ? cierre.cajaContadaUsd : totalReal.toFixed(2);
  const diferencia = cierre ? cierre.diferenciaUsd : totalReal.minus(esperado).toFixed(2);
  const hayCarga = !!cierre || renglonesValidos.length > 0;

  const puedeGuardar = !cierre && !guardando && !!tcCanon && renglonesValidos.length > 0 && invalidos.length === 0
    && (saldoInicial === null || saldoInicialCanon !== null);

  async function guardar() {
    if (!preview || !tcCanon) return;
    setGuardando(true);
    setError(null);
    try {
      await api.post<Cierre>('/closing', {
        fecha: fechaApi(fecha),
        tcCierre: tcCanon,
        saldoInicialUsd: saldoInicialCanon ?? preview.saldoInicialUsd,
        saldosReales: renglonesValidos.map((r) => ({
          moneda: r.moneda,
          montoUsd: decimalCanonico(r.montoUsd),
          detalle: r.detalle.trim() || null,
        })),
        notas: notas.trim() || null,
      });
      await cargar();
    } catch (e) {
      setError(errorDe(e, 'No pude guardar el cierre'));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(accion: 'confirm' | 'reopen') {
    if (!cierre) return;
    setError(null);
    try {
      await api.post(`/closing/${cierre.id}/${accion}`);
      await cargar();
    } catch (e) {
      setError(errorDe(e, 'No pude cambiar el estado del cierre'));
    }
  }

  const movColumns: DataColumn<Movimiento>[] = [
    { header: 'Moneda', primary: true, cell: (m) => <span className="font-semibold">{m.moneda}</span> },
    { header: 'Neto', trailing: true, align: 'right', cell: (m) => (
      <span className="currency font-semibold" style={{ color: Number(m.neto) === 0 ? 'var(--warm-gray-2)' : Number(m.neto) > 0 ? 'var(--success)' : 'var(--danger)' }}>
        {conSigno(m.neto)}
      </span>
    ) },
    { header: 'Entradas', align: 'right', cell: (m) => (
      <span className="currency inline-flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />{fmt(m.entradas)}</span>
    ) },
    { header: 'Salidas', align: 'right', cell: (m) => (
      <span className="currency inline-flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />{fmt(m.salidas)}</span>
    ) },
  ];

  async function borrarMovimiento(ruta: string) {
    setError(null);
    try {
      await api.delete(ruta);
      await cargar();
    } catch (e) {
      setError(errorDe(e, 'No pude borrar el movimiento'));
    }
  }

  const editable = !cierre;

  const tonoDif = Number(diferencia) === 0 ? 'var(--success)' : Number(diferencia) > 0 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>Cierre Diario</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Movimientos del día, saldos reales y diferencia contra lo esperado
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {cierre && (
            <span className={`badge ${cierre.estado === 'confirmado' ? 'badge-success' : 'badge-warning'}`}>
              {cierre.estado === 'confirmado' && <Lock className="w-3.5 h-3.5" />}
              {ESTADO_LABEL[cierre.estado]}
            </span>
          )}
          <input type="date" className="input" value={fecha} max={hoyYmd()}
                 onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Fecha del cierre" />
        </div>
      </header>

      {error && (
        <div className="card p-3" role="alert" style={{ borderColor: 'var(--danger)' }}>
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {cargando || !preview ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="card p-4 animate-pulse" style={{ height: 72 }} />)}
        </div>
      ) : (
        <>
          {preview.nOpsSinFinalizar > 0 && (
            <div className="card p-4 flex items-start gap-3" style={{ borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <p className="m-0 text-[14px]">
                {preview.nOpsSinFinalizar === 1 ? 'Hay 1 operación' : `Hay ${preview.nOpsSinFinalizar} operaciones`} del día sin
                finalizar: no entran en el cierre hasta que se completen.
              </p>
            </div>
          )}

          {/* 1 · Movimientos del día (#13: todo en USD) */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="m-0">1 · Movimientos del día</h2>
              <p className="m-0 mt-1 caption" style={{ color: 'var(--warm-gray-3)' }}>
                Todo en dólares. En cables y USDT la ganancia queda implícita: ingreso − egreso − comisión (la comisión la paga la oficina).
              </p>
            </div>

            <div className="grid-4">
              <Dato label="Ganancia del día" valor={usd(preview.gananciaTotalUsd)} tono={Number(preview.gananciaTotalUsd) < 0 ? 'bad' : 'ok'}
                    sub={`cambio ${fmt(new Decimal(preview.gananciaRealizadaUsd).minus(preview.totalComisionesUsd).toFixed(2))} · cables ${fmt(preview.totalCables.gananciaUsd)} · USDT ${fmt(preview.totalUsdt.gananciaUsd)}`} />
              <Dato label="Gastos del día" valor={usd(preview.totalGastosUsd)} tono={Number(preview.totalGastosUsd) > 0 ? 'bad' : undefined}
                    sub="oficina + jefe" />
              <Dato label="Jefe · a devolver" valor={usd(preview.deudaJefeUsd)} tono={Number(preview.deudaJefeUsd) > 0 ? 'warn' : undefined}
                    sub="sale de la caja, no es gasto" />
              <Dato label="Resultado del día" valor={usd(preview.resultadoOperativoUsd)}
                    tono={Number(preview.resultadoOperativoUsd) < 0 ? 'bad' : 'ok'} sub="ganancia − gastos del día" />
            </div>

            <BloqueMovUsd titulo="Cables" ruta="cables" filas={preview.cables} totales={preview.totalCables}
                          editable={editable} fecha={fecha} onCambio={cargar} onBorrar={borrarMovimiento} onError={setError} />
            <BloqueMovUsd titulo="USDT" ruta="usdt" filas={preview.usdt} totales={preview.totalUsdt}
                          editable={editable} fecha={fecha} onCambio={cargar} onBorrar={borrarMovimiento} onError={setError} />
            <BloqueGastos gastos={preview.gastos} total={preview.totalGastosUsd} deudaJefe={preview.deudaJefeUsd}
                          editable={editable} fecha={fecha} onCambio={cargar} onBorrar={borrarMovimiento} onError={setError} />
            <BloqueSaldosClientes movs={preview.saldoClientes} netoCaja={preview.saldoClientesNetoCajaUsd} />

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="m-0 text-[15px] font-semibold">Operaciones de cambio</h3>
                <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
                  {preview.nOpsFinalizadas} finalizadas · ganancia por spread {usd(preview.gananciaRealizadaUsd)}
                  {Number(preview.totalComisionesUsd) > 0 ? ` · comisiones ${usd(preview.totalComisionesUsd)}` : ''}
                </span>
              </div>
              <DataList
                columns={movColumns}
                rows={preview.movimientos}
                rowKey={(m) => m.moneda}
                empty={<Vacio texto="Sin operaciones de cambio finalizadas en el día" />}
              />
            </div>
          </section>

          {/* 2 · Saldos reales */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="m-0">2 · Saldos reales</h2>
              <p className="m-0 mt-1 caption" style={{ color: 'var(--warm-gray-3)' }}>
                Cada saldo se carga por su valor en USD. Podés cargar varios renglones de una misma moneda
                (por ejemplo, euros comprados a distintas cotizaciones).
              </p>
            </div>

            {cierre ? (
              <div className="card p-4 flex flex-col gap-2">
                {cierre.saldosReales.length === 0 && (
                  <p className="m-0 caption" style={{ color: 'var(--warm-gray-3)' }}>Este cierre se guardó sólo con el total contado.</p>
                )}
                {cierre.saldosReales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="badge badge-neutral">{s.moneda}</span>
                      <span className="caption truncate" style={{ color: 'var(--warm-gray-2)' }}>{s.detalle}</span>
                    </span>
                    <span className="currency">{usd(s.montoUsd)}</span>
                  </div>
                ))}
                <p className="m-0 pt-2 caption" style={{ borderTop: '1px solid var(--border)', color: 'var(--warm-gray-3)' }}>
                  Saldo inicial {usd(cierre.saldoInicialUsd)} · TC de cierre {fmt(cierre.tcCierre)} · cerró {cierre.operadorCierreNombre}
                  {cierre.notas ? ` · ${cierre.notas}` : ''}
                </p>
              </div>
            ) : (
              <div className="card p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="caption">Saldo inicial (USD)</span>
                    <input className="input currency" inputMode="decimal"
                           value={saldoInicial ?? preview.saldoInicialUsd}
                           onChange={(e) => setSaldoInicial(e.target.value)} />
                    <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
                      {preview.saldoInicialSugeridoUsd !== null
                        ? `Sugerido: caja contada del cierre anterior (${usd(preview.saldoInicialSugeridoUsd)})`
                        : 'No hay un cierre anterior para sugerirlo'}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="caption">TC de cierre (ARS por USD)</span>
                    <input className="input currency" inputMode="decimal" value={tcCierre} onChange={(e) => setTcCierre(e.target.value)} />
                    <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>Pasa a USD la ganancia de las operaciones en pesos</span>
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  {renglones.map((r) => {
                    const malo = r.montoUsd.trim() !== '' && decimalCanonico(r.montoUsd) === null;
                    const set = (patch: Partial<Renglon>) =>
                      setRenglones((rs) => rs.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
                    return (
                      <div key={r.key} className="grid grid-cols-[88px_1fr_auto] sm:grid-cols-[100px_160px_1fr_auto] gap-2 items-center">
                        <select className="input" value={r.moneda} onChange={(e) => set({ moneda: e.target.value as Moneda })} aria-label="Moneda">
                          {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input className="input currency" inputMode="decimal" placeholder="valor en USD"
                               value={r.montoUsd} onChange={(e) => set({ montoUsd: e.target.value })}
                               aria-label={`Valor en USD (${r.moneda})`} aria-invalid={malo}
                               style={malo ? { borderColor: 'var(--danger)' } : undefined} />
                        <input className="input col-span-3 sm:col-span-1 row-start-2 sm:row-start-auto" placeholder="detalle (opcional), p. ej. 1.000 EUR a 1,08"
                               value={r.detalle} onChange={(e) => set({ detalle: e.target.value })} aria-label="Detalle" />
                        <button type="button" className="iconbtn iconbtn-danger row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto" title="Quitar renglón"
                                onClick={() => setRenglones((rs) => (rs.length === 1 ? [renglonVacio()] : rs.filter((x) => x.key !== r.key)))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {invalidos.length > 0 && (
                    <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">
                      Revisá los valores marcados: tienen que ser números positivos (ej. 1250,50).
                    </p>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm self-start"
                          onClick={() => setRenglones((rs) => [...rs, renglonVacio(rs[rs.length - 1]?.moneda)])}>
                    <Plus className="w-3.5 h-3.5" /> Agregar renglón
                  </button>
                </div>

                {subtotales.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    {subtotales.map((s) => (
                      <span key={s.moneda} className="badge badge-neutral">{s.moneda} · {usd(s.total)}</span>
                    ))}
                  </div>
                )}

                <label className="flex flex-col gap-1">
                  <span className="caption">Notas (opcional)</span>
                  <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
                </label>
              </div>
            )}
          </section>

          {/* 3 · Diferencia */}
          <section className="flex flex-col gap-3">
            <h2 className="m-0">3 · Esperado vs. real</h2>
            <div className="card p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Cifra label="Saldo esperado" valor={usd(esperado)}
                       sub={Number(preview.saldoClientesNetoCajaUsd) !== 0
                         ? 'saldo inicial + resultado − jefe a devolver ± saldos de clientes en caja'
                         : 'saldo inicial + resultado − jefe a devolver'} />
                <Cifra label="Saldo real" valor={hayCarga ? usd(real) : '—'} sub="suma de los saldos reales" />
                <div className="flex flex-col gap-1 p-3 rounded-lg" style={{ background: hayCarga ? `color-mix(in srgb, ${tonoDif} 10%, transparent)` : 'var(--bg-base)' }}>
                  <span className="caption">Diferencia</span>
                  <span className="text-[26px] font-bold tabular" style={{ color: hayCarga ? tonoDif : 'var(--warm-gray-3)' }}>
                    {hayCarga ? `US$ ${conSigno(diferencia)}` : '—'}
                  </span>
                  <span className="caption flex items-center gap-1" style={{ color: hayCarga ? tonoDif : 'var(--warm-gray-3)' }}>
                    {!hayCarga ? 'Cargá los saldos reales'
                      : Number(diferencia) === 0 ? <><CheckCircle className="w-3.5 h-3.5" /> La caja cierra justo</>
                      : Number(diferencia) > 0 ? 'Sobrante: hay más de lo esperado'
                      : 'Faltante: hay menos de lo esperado'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {!cierre && (
                  <button className="btn btn-primary" disabled={!puedeGuardar} onClick={() => void guardar()}>
                    <Save className="w-4 h-4" />
                    {guardando ? 'Guardando…' : 'Guardar cierre'}
                  </button>
                )}
                {cierre && esAdmin && cierre.estado !== 'confirmado' && (
                  <button className="btn btn-primary" onClick={() => void cambiarEstado('confirm')}>
                    <Lock className="w-4 h-4" /> Confirmar cierre
                  </button>
                )}
                {cierre && esAdmin && cierre.estado === 'confirmado' && (
                  <button className="btn btn-secondary" onClick={() => void cambiarEstado('reopen')}>
                    <RotateCcw className="w-4 h-4" /> Reabrir
                  </button>
                )}
                {cierre && !esAdmin && cierre.estado !== 'confirmado' && (
                  <span className="caption self-center" style={{ color: 'var(--warm-gray-3)' }}>Lo confirma un administrador</span>
                )}
              </div>
            </div>
          </section>

          {cierre && <ReporteWhatsApp cierreId={cierre.id} estado={cierre.estado} />}
        </>
      )}
    </div>
  );
}

/**
 * #19 — Movimientos de saldo de clientes del día. Se cargan desde la ficha del cliente
 * o salen de operaciones contra saldo. Sólo los de clientes con el saldo dentro de la
 * caja cuentan en el saldo esperado.
 */
function BloqueSaldosClientes({ movs, netoCaja }: { movs: MovSaldoCliente[]; netoCaja: string }) {
  const columnas: DataColumn<MovSaldoCliente>[] = [
    { header: 'Cliente', primary: true, cell: (m) => (
      <span className="flex items-center gap-2 min-w-0">
        <span className="truncate">{m.clienteNombre}</span>
        <span className="caption truncate" style={{ color: 'var(--warm-gray-3)' }}>
          {m.opCodigo ? `Operación ${m.opCodigo}` : m.tipo === 'credito' ? 'Ingreso' : 'Retiro'}
        </span>
      </span>
    ) },
    { header: 'USD', trailing: true, align: 'right', cell: (m) => (
      <span className="currency font-semibold" style={{ color: m.tipo === 'credito' ? 'var(--success)' : 'var(--danger)' }}>
        {m.tipo === 'credito' ? '+' : '−'}{fmt(m.montoUsd)}
      </span>
    ) },
    { header: 'Saldo', cell: (m) => (
      <span className={`badge ${m.enCaja ? 'badge-neutral' : 'badge-info'}`}>{m.enCaja ? 'en caja' : 'separado'}</span>
    ) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="m-0 text-[15px] font-semibold">Saldos de clientes</h3>
        {movs.length > 0 && (
          <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
            neto en caja <strong>{usd(netoCaja)}</strong>
          </span>
        )}
      </div>
      <DataList columns={columnas} rows={movs} rowKey={(m) => m.id} empty={<Vacio texto="Sin movimientos de saldo de clientes en el día" />} />
    </div>
  );
}

/** Texto del reporte para WhatsApp (los asteriscos son negrita en WhatsApp). */
function textoReporte(r: Reporte): string {
  const dia = new Date(r.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  const lineas = [
    `*Cierre del ${dia}*${r.estado === 'confirmado' ? '' : ' (sin confirmar)'}`,
    '',
    '*Ganancias*',
    `Cambio: ${usd(r.gananciaCambioUsd)}`,
    `Cables: ${usd(r.gananciaCablesUsd)}`,
    `USDT: ${usd(r.gananciaUsdtUsd)}`,
    `Total: ${usd(r.gananciaTotalUsd)}`,
    `Gastos del día: ${usd(r.totalGastosUsd)}`,
    `Resultado: ${usd(r.resultadoOperativoUsd)}`,
    '',
    '*Caja*',
    `Saldo de caja: ${usd(r.cajaContadaUsd)}`,
    `Esperado: ${usd(r.posicionEsperadaUsd)} · diferencia US$ ${conSigno(r.diferenciaUsd)}`,
    '',
    '*Saldos de clientes*',
    ...(r.saldosClientes.length === 0
      ? ['Sin saldos']
      : r.saldosClientes.map((s) => `${s.clienteNombre}: ${usd(s.saldoUsdCierre)}${s.custodia === 'separada' ? ' (separado)' : ''}`)),
    `Total en caja: ${usd(r.totalSaldosCajaUsd)}`,
    ...(Number(r.totalSaldosSeparadosUsd) !== 0 ? [`Total separado: ${usd(r.totalSaldosSeparadosUsd)}`] : []),
    '',
    `*Balance: ${usd(r.balanceUsd)}*`,
    '(saldo de caja − saldos de clientes en caja)',
  ];
  return lineas.join('\n');
}

/** #19 — Reporte del cierre para mandarle al jefe por WhatsApp. */
function ReporteWhatsApp({ cierreId, estado }: { cierreId: string; estado: string }) {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api.get<Reporte>(`/closing/${cierreId}/reporte`)
      .then((r) => { if (!cancelado) setReporte(r); })
      .catch((e) => { if (!cancelado) setError(errorDe(e, 'No pude armar el reporte')); });
    return () => { cancelado = true; };
  }, [cierreId, estado]);

  const texto = reporte ? textoReporte(reporte) : '';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No pude copiar el texto: seleccionalo y copialo a mano');
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0">4 · Reporte para el jefe</h2>
        <p className="m-0 mt-1 caption" style={{ color: 'var(--warm-gray-3)' }}>
          Ganancias, saldo de caja, saldos de clientes y balance, listo para mandar por WhatsApp.
        </p>
      </div>
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
      {reporte && (
        <div className="card p-4 flex flex-col gap-3">
          <pre className="m-0 text-[13px] whitespace-pre-wrap" style={{ fontFamily: 'inherit' }}>{texto}</pre>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copiar()}>
              <Copy className="w-3.5 h-3.5" /> {copiado ? 'Copiado' : 'Copiar'}
            </button>
            <a className="btn btn-primary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="w-3.5 h-3.5" /> Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="card p-4 text-center caption" style={{ color: 'var(--warm-gray-3)' }}>{texto}</div>;
}

interface BloqueProps {
  editable: boolean;
  fecha: string;
  onCambio: () => Promise<void>;
  onBorrar: (ruta: string) => Promise<void>;
  onError: (e: string | null) => void;
}

/** #13 — Cables o USDT: ingreso, egreso y comisión en USD; la ganancia la calcula el backend. */
function BloqueMovUsd({ titulo, ruta, filas, totales, editable, fecha, onCambio, onBorrar, onError }: BloqueProps & {
  titulo: string; ruta: 'cables' | 'usdt'; filas: MovUsd[]; totales: TotalesUsd;
}) {
  const [f, setF] = useState({ ingreso: '', egreso: '', comision: '', notas: '' });
  const [enviando, setEnviando] = useState(false);
  const ingreso = decimalCanonico(f.ingreso);
  const egreso = decimalCanonico(f.egreso);
  const comision = f.comision.trim() === '' ? '0' : decimalCanonico(f.comision);
  const valido = !!ingreso && !!egreso && comision !== null && Number(ingreso) > 0 && Number(egreso) > 0;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    onError(null);
    try {
      await api.post(`/movimientos/${ruta}`, {
        ingresoUsd: ingreso, egresoUsd: egreso, comisionUsd: comision, notas: f.notas.trim() || null, fecha: fechaApi(fecha),
      });
      setF({ ingreso: '', egreso: '', comision: '', notas: '' });
      await onCambio();
    } catch (err) {
      onError(errorDe(err, `No pude agregar el movimiento de ${titulo}`));
    } finally {
      setEnviando(false);
    }
  }

  const columnas: DataColumn<MovUsd>[] = [
    { header: 'Código', primary: true, cell: (m) => (
      <span className="flex items-center gap-2 min-w-0">
        <span className="mono text-[13px]">{m.codigo}</span>
        {m.notas && <span className="caption truncate" style={{ color: 'var(--warm-gray-3)' }}>{m.notas}</span>}
      </span>
    ) },
    { header: 'Ganancia', trailing: true, align: 'right', cell: (m) => (
      <span className="currency font-semibold" style={{ color: Number(m.gananciaUsd) < 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(m.gananciaUsd)}</span>
    ) },
    { header: 'Ingreso', align: 'right', cell: (m) => <span className="currency">{fmt(m.ingresoUsd)}</span> },
    { header: 'Egreso', align: 'right', cell: (m) => <span className="currency">{fmt(m.egresoUsd)}</span> },
    { header: 'Comisión', align: 'right', cell: (m) => <span className="currency">{fmt(m.comisionUsd)}</span> },
    ...(editable ? [{ header: '', align: 'right' as const, cell: (m: MovUsd) => (
      <button type="button" className="iconbtn iconbtn-danger" title="Borrar" onClick={() => void onBorrar(`/movimientos/${ruta}/${m.id}`)}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    ) }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="m-0 text-[15px] font-semibold">{titulo}</h3>
        {filas.length > 0 && (
          <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
            ingreso {fmt(totales.ingresoUsd)} · egreso {fmt(totales.egresoUsd)} · comisión {fmt(totales.comisionUsd)} ·{' '}
            <strong style={{ color: Number(totales.gananciaUsd) < 0 ? 'var(--danger)' : 'var(--success)' }}>ganancia {usd(totales.gananciaUsd)}</strong>
          </span>
        )}
      </div>
      <DataList columns={columnas} rows={filas} rowKey={(m) => m.id} empty={<Vacio texto={`Sin ${titulo.toLowerCase() === 'usdt' ? 'operaciones de USDT' : 'cables'} en el día`} />} />
      {editable && (
        <form className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] gap-2 items-center" onSubmit={agregar}>
          <input className="input currency" inputMode="decimal" placeholder="Ingreso USD" value={f.ingreso}
                 onChange={(e) => setF({ ...f, ingreso: e.target.value })} aria-label={`${titulo}: ingreso en USD`} />
          <input className="input currency" inputMode="decimal" placeholder="Egreso USD" value={f.egreso}
                 onChange={(e) => setF({ ...f, egreso: e.target.value })} aria-label={`${titulo}: egreso en USD`} />
          <input className="input currency" inputMode="decimal" placeholder="Comisión USD" value={f.comision}
                 onChange={(e) => setF({ ...f, comision: e.target.value })} aria-label={`${titulo}: comisión en USD`} />
          <input className="input" placeholder="Nota (opcional)" value={f.notas}
                 onChange={(e) => setF({ ...f, notas: e.target.value })} aria-label={`${titulo}: nota`} />
          <button type="submit" className="btn btn-secondary btn-sm col-span-2 sm:col-span-1" disabled={!valido || enviando}>
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </form>
      )}
    </div>
  );
}

/** #13 — Gastos en USD: de la oficina, del jefe (gasto del día) o del jefe a devolver (deuda). */
function BloqueGastos({ gastos, total, deudaJefe, editable, fecha, onCambio, onBorrar, onError }: BloqueProps & {
  gastos: Gasto[]; total: string; deudaJefe: string;
}) {
  const [f, setF] = useState<{ concepto: string; monto: string; tipo: GastoTipo }>({ concepto: '', monto: '', tipo: 'OFICINA' });
  const [enviando, setEnviando] = useState(false);
  const monto = decimalCanonico(f.monto);
  const valido = f.concepto.trim() !== '' && !!monto && Number(monto) > 0;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    onError(null);
    try {
      await api.post('/movimientos/gastos', { concepto: f.concepto.trim(), montoUsd: monto, tipo: f.tipo, fecha: fechaApi(fecha) });
      setF({ concepto: '', monto: '', tipo: f.tipo });
      await onCambio();
    } catch (err) {
      onError(errorDe(err, 'No pude agregar el gasto'));
    } finally {
      setEnviando(false);
    }
  }

  const columnas: DataColumn<Gasto>[] = [
    { header: 'Concepto', primary: true, cell: (g) => g.concepto },
    { header: 'USD', trailing: true, align: 'right', cell: (g) => (
      <span className="currency font-semibold" title={g.montoArs ? `Cargado en pesos: ARS ${fmt(g.montoArs)}` : undefined}>
        {fmt(g.montoUsd)}{g.montoArs && <span className="caption ml-1" style={{ color: 'var(--warm-gray-3)' }}>(ARS)</span>}
      </span>
    ) },
    { header: 'De', cell: (g) => (
      <span className={`badge ${g.tipo === 'OFICINA' ? 'badge-neutral' : g.tipo === 'JEFE' ? 'badge-info' : 'badge-warning'}`}>{GASTO_TIPO_LABEL[g.tipo]}</span>
    ) },
    ...(editable ? [{ header: '', align: 'right' as const, cell: (g: Gasto) => (
      <button type="button" className="iconbtn iconbtn-danger" title="Borrar" onClick={() => void onBorrar(`/movimientos/gastos/${g.id}`)}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    ) }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="m-0 text-[15px] font-semibold">Gastos</h3>
        {gastos.length > 0 && (
          <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>
            gastos del día <strong style={{ color: 'var(--danger)' }}>{usd(total)}</strong>
            {Number(deudaJefe) > 0 && <> · jefe a devolver <strong style={{ color: 'var(--warning)' }}>{usd(deudaJefe)}</strong></>}
          </span>
        )}
      </div>
      <DataList columns={columnas} rows={gastos} rowKey={(g) => g.id} empty={<Vacio texto="Sin gastos en el día" />} />
      {editable && (
        <form className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1.4fr_auto] gap-2 items-center" onSubmit={agregar}>
          <input className="input col-span-2 sm:col-span-1" placeholder="Concepto" value={f.concepto}
                 onChange={(e) => setF({ ...f, concepto: e.target.value })} aria-label="Gasto: concepto" />
          <input className="input currency" inputMode="decimal" placeholder="Monto USD" value={f.monto}
                 onChange={(e) => setF({ ...f, monto: e.target.value })} aria-label="Gasto: monto en USD" />
          <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as GastoTipo })} aria-label="Gasto: de quién">
            <option value="OFICINA">Oficina</option>
            <option value="JEFE">Jefe · gasto del día</option>
            <option value="JEFE_A_DEVOLVER">Jefe · a devolver</option>
          </select>
          <button type="submit" className="btn btn-secondary btn-sm col-span-2 sm:col-span-1" disabled={!valido || enviando}>
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </form>
      )}
    </div>
  );
}

function Dato({ label, valor, sub, tono }: { label: string; valor: string; sub?: string; tono?: 'ok' | 'bad' | 'warn' }) {
  return (
    <article className="card stat-card">
      <span className="stat-label truncate">{label}</span>
      <span className="stat-value" style={{ color: tono === 'ok' ? 'var(--success)' : tono === 'bad' ? 'var(--danger)' : tono === 'warn' ? 'var(--warning)' : 'var(--warm-gray-1)' }}>
        {valor}
      </span>
      {sub && <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>{sub}</span>}
    </article>
  );
}

function Cifra({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <span className="caption">{label}</span>
      <span className="text-[22px] font-semibold tabular">{valor}</span>
      <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>{sub}</span>
    </div>
  );
}
