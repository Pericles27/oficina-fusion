'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ArrowRightLeft, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useCaja, type KpiOperador, type KpiPar } from '@/lib/caja-store';
import { DataList, type DataColumn } from '@/components/DataList';

/**
 * #9 — Dashboard: datos generales del día (ganancia, volumen, operaciones
 * pendientes, último cierre). El detalle de cada operación vive en la Mesa
 * de Operaciones; acá no se repite la planilla.
 *
 * Las cifras de dinero las calcula el backend (GET /operations/kpis/*).
 */

interface KpisParDia {
  stats: KpiPar[];
  gananciaUsd: string;
  volumenUsd: string;
  monedasSinCotizacion?: string[];
}
interface UltimoCierre { id: string; fecha: string; estado: string; diferenciaUsd: string }

const fmt = (v: string | number, digits = 2) =>
  Number(v).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd = (v: string | number) => `US$ ${fmt(v)}`;

export default function DashboardPage() {
  const { state } = useCaja();
  const [kpis, setKpis] = useState<KpisParDia | null>(null);
  const [operadores, setOperadores] = useState<KpiOperador[]>([]);
  const [ultimoCierre, setUltimoCierre] = useState<UltimoCierre | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { desde, hasta } = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const h = new Date(d);
    h.setDate(h.getDate() + 1);
    return { desde: d, hasta: h };
  }, []);

  // Se recarga cuando cambian las operaciones (alta, estado, cancelación).
  useEffect(() => {
    const rango = `startDate=${encodeURIComponent(desde.toISOString())}&endDate=${encodeURIComponent(hasta.toISOString())}`;
    let cancelado = false;
    (async () => {
      try {
        const [par, op, cierres] = await Promise.all([
          api.get<KpisParDia>(`/operations/kpis/par?${rango}`),
          api.get<{ stats: KpiOperador[] }>(`/operations/kpis/operador?${rango}`),
          api.get<{ data: UltimoCierre[] }>('/closing?pageSize=1'),
        ]);
        if (cancelado) return;
        setKpis(par);
        setOperadores(op.stats);
        setUltimoCierre(cierres.data[0] ?? null);
        setError(null);
      } catch {
        if (!cancelado) setError('No pude cargar los indicadores del día');
      }
    })();
    return () => { cancelado = true; };
  }, [desde, hasta, state.operaciones]);

  const opsHoy = state.operaciones.filter((o) => {
    const ts = new Date(o.ts);
    return ts >= desde && ts < hasta;
  });
  // Pendientes y en curso de cualquier día: son lo que hay que resolver.
  const pendientes = state.operaciones.filter((o) => o.status === 'pendiente').length;
  const enCurso = state.operaciones.filter((o) => o.status === 'ejecucion').length;
  const completadasHoy = opsHoy.filter((o) => o.status === 'finalizada').length;

  const ganancia = kpis?.gananciaUsd ?? '0';
  const fechaLarga = desde.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaHoy = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);

  const parColumns: DataColumn<KpiPar>[] = [
    { header: 'Par', primary: true, cell: (k) => <span className="font-semibold">{k.par}</span> },
    { header: 'Ganancia', trailing: true, align: 'right', cell: (k) => (
      <span className="currency font-semibold" style={{ color: Number(k.gananciaUsd) < 0 ? 'var(--danger)' : 'var(--success)' }}>{usd(k.gananciaUsd)}</span>
    ) },
    { header: 'Ops', align: 'right', cell: (k) => <span className="tabular">{k.nOps}</span> },
    { header: 'Volumen', align: 'right', cell: (k) => <span className="currency">{usd(k.volumenTotalUsd)}</span> },
  ];
  const opColumns: DataColumn<KpiOperador>[] = [
    { header: 'Operador', primary: true, cell: (k) => k.operadorNombre },
    { header: 'Ops', trailing: true, align: 'right', cell: (k) => <span className="tabular">{k.nOps}</span> },
    { header: 'Volumen', align: 'right', cell: (k) => <span className="currency">{usd(k.volumenTotalUsd)}</span> },
  ];

  return (
    <div className="page animate-in">
      <header>
        <h1>Dashboard</h1>
        <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>{fechaHoy}</p>
      </header>

      {error && (
        <div className="card p-3" role="alert" style={{ borderColor: 'var(--danger)' }}>
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}
      {!!kpis?.monedasSinCotizacion?.length && (
        <div className="card p-3 flex items-center gap-2" style={{ borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} />
          <span className="text-[13.5px]">Sin cotización a USD para {kpis.monedasSinCotizacion.join(', ')}: la ganancia de esos pares figura en 0.</span>
        </div>
      )}

      <section className="grid-4">
        <Kpi label="Ganancia del día" valor={kpis ? usd(ganancia) : '—'}
             tono={!kpis ? undefined : Number(ganancia) < 0 ? 'bad' : 'ok'} sub="spread − comisiones · incluye pendientes" />
        <Kpi label="Operaciones de hoy" valor={String(opsHoy.length)} sub={`${completadasHoy} completadas`} />
        <Kpi label="Pendientes" valor={String(pendientes)} tono={pendientes > 0 ? 'warn' : undefined}
             sub={enCurso > 0 ? `+ ${enCurso} en curso` : 'sin operaciones en curso'} />
        <Kpi label="Volumen del día" valor={kpis ? usd(kpis.volumenUsd) : '—'} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="m-0">Ganancia por par</h2>
          <DataList columns={parColumns} rows={kpis?.stats ?? []} rowKey={(k) => k.par}
                    empty={<Vacio texto={kpis ? 'Todavía no hay operaciones hoy' : 'Cargando…'} />} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="m-0">Por operador</h2>
          <DataList columns={opColumns} rows={operadores} rowKey={(k) => k.operadorId}
                    empty={<Vacio texto={kpis ? 'Todavía no hay operaciones hoy' : 'Cargando…'} />} />
        </section>
      </div>

      <section className="grid-2">
        <Link href="/admin/operations" className="card p-4 flex items-center gap-3">
          <ArrowRightLeft className="w-5 h-5 shrink-0" style={{ color: 'var(--blue)' }} />
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-medium">Mesa de Operaciones</span>
            <span className="block caption" style={{ color: 'var(--warm-gray-3)' }}>Cargar y seguir las operaciones del día</span>
          </span>
          <ArrowRight className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
        </Link>
        <Link href="/admin/closing" className="card p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 shrink-0" style={{ color: 'var(--blue)' }} />
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-medium">Cierre Diario</span>
            <span className="block caption" style={{ color: 'var(--warm-gray-3)' }}>
              {ultimoCierre
                ? `Último: ${new Date(ultimoCierre.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · ${ultimoCierre.estado} · dif. ${usd(ultimoCierre.diferenciaUsd)}`
                : 'Todavía no hay cierres'}
            </span>
          </span>
          <ArrowRight className="w-4 h-4" style={{ color: 'var(--warm-gray-3)' }} />
        </Link>
      </section>
    </div>
  );
}

function Kpi({ label, valor, sub, tono }: { label: string; valor: string; sub?: string; tono?: 'ok' | 'bad' | 'warn' }) {
  const color = tono === 'ok' ? 'var(--success)' : tono === 'bad' ? 'var(--danger)' : tono === 'warn' ? 'var(--warning)' : 'var(--warm-gray-1)';
  return (
    <article className="card stat-card">
      <span className="stat-label truncate">{label}</span>
      <span className="stat-value" style={{ color }}>{valor}</span>
      {sub && <span className="caption" style={{ color: 'var(--warm-gray-3)' }}>{sub}</span>}
    </article>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="card p-6 text-center caption" style={{ color: 'var(--warm-gray-3)' }}>{texto}</div>;
}
