'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileText, CheckCircle, Mail, Eye, Clock, Plus, Search } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/DataList';
import { SearchBar, Pagination, EmptyState } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

/**
 * F5 — e-tickets reales desde GET /e-tickets. Con token de CADETE el
 * backend fuerza estado=pendiente y aplica un `select` explícito que
 * NUNCA incluye montoEntregar/montoRecibir/monedas (ver
 * e-tickets.service.ts ETICKET_CADETE_SELECT). No hay nada que filtrar
 * acá: el scope ya viene resuelto por el servidor a partir del token.
 */

type EticketEstado = 'pendiente' | 'en_curso' | 'confirmado' | 'cancelado';

interface ApiEticket {
  id: string;
  numero: number;
  codigo: string;
  ts: string;
  estado: EticketEstado;
  clienteId: string;
  metodoEntrega: string;
  direccionEntrega: string | null;
  cliente?: { nombre: string; apellido?: string | null } | null;
}

interface Ticket {
  id: string;
  codigo: string;
  client: string;
  type: string;
  status: string;
  date: string;
  time: string;
}

const ESTADO_LABEL: Record<EticketEstado, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
};

const statusMeta: Record<string, { cls: string; icon: React.ReactNode }> = {
  Pendiente: { cls: 'badge-warning', icon: <Clock className="w-3 h-3" /> },
  'En curso': { cls: 'badge-blue', icon: <Mail className="w-3 h-3" /> },
  Confirmado: { cls: 'badge-success', icon: <CheckCircle className="w-3 h-3" /> },
  Cancelado: { cls: 'badge-danger', icon: <Eye className="w-3 h-3" /> },
};

const METODO_LABEL: Record<string, string> = {
  en_mano: 'En mano',
  deposito_banco: 'Depósito',
};

function ticketFromApi(e: ApiEticket): Ticket {
  const fecha = new Date(e.ts);
  return {
    id: e.id,
    codigo: e.codigo,
    client: e.cliente
      ? e.cliente.apellido
        ? `${e.cliente.nombre} ${e.cliente.apellido}`
        : e.cliente.nombre
      : '',
    type: METODO_LABEL[e.metodoEntrega] ?? e.metodoEntrega,
    status: ESTADO_LABEL[e.estado] ?? e.estado,
    date: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    time: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  };
}

const PER_PAGE = 5;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get<{ data: ApiEticket[] }>('/e-tickets?pageSize=200');
      setTickets(res.data.map(ticketFromApi));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pude cargar los e-tickets');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      t.codigo.toLowerCase().includes(q) || t.client.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) || t.status.toLowerCase().includes(q)
    );
  }, [search, tickets]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const counts = useMemo(() => ({
    Pendiente: tickets.filter((t) => t.status === 'Pendiente').length,
    'En curso': tickets.filter((t) => t.status === 'En curso').length,
    Confirmado: tickets.filter((t) => t.status === 'Confirmado').length,
  }), [tickets]);

  const summary = [
    { label: 'Pendientes', value: counts.Pendiente, icon: Clock, tint: 'var(--warning)' },
    { label: 'En curso', value: counts['En curso'], icon: Mail, tint: 'var(--blue)' },
    { label: 'Confirmados', value: counts.Confirmado, icon: CheckCircle, tint: 'var(--success)' },
    { label: 'Total', value: tickets.length, icon: FileText, tint: 'var(--info)' },
  ];

  const columns: DataColumn<Ticket>[] = [
    { header: 'ID', primary: true, cell: (t) => <span className="mono text-[13px]" style={{ color: 'var(--blue)' }}>{t.codigo}</span> },
    { header: 'Estado', trailing: true, cell: (t) => {
      const m = statusMeta[t.status];
      return <span className={`badge ${m?.cls ?? 'badge-neutral'}`}>{m?.icon}{t.status}</span>;
    } },
    { header: 'Cliente', cell: (t) => t.client || <span className="tone-muted">—</span> },
    { header: 'Entrega', cell: (t) => <span className="badge badge-neutral">{t.type}</span> },
    { header: 'Fecha', align: 'right', cell: (t) => <span className="tabular" style={{ color: 'var(--warm-gray-2)' }}>{t.date} · {t.time}</span> },
  ];

  return (
    <div className="page animate-in">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1>E-Tickets</h1>
          <p className="text-small m-0 mt-1" style={{ color: 'var(--warm-gray-2)' }}>
            Entregas pendientes — bolsa común
          </p>
        </div>
        {/* F5: fuera de alcance — crear e-tickets es ADMIN/OPERADOR
            (e-tickets.controller.ts:35). Esta página sigue hardcodeada,
            reportado explícitamente en el entregable. */}
        <Link href="/cadete/tickets/new" className="btn btn-primary btn-sm no-underline">
          <Plus className="w-4 h-4" />
          Nuevo
        </Link>
      </header>

      {error && (
        <div className="card p-3" style={{ borderColor: 'var(--danger)' }}>
          <span className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      <section className="grid-4">
        {summary.map((s) => (
          <article key={s.label} className="card stat-card">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label truncate">{s.label}</span>
              <s.icon className="w-[18px] h-[18px] shrink-0" style={{ color: s.tint }} />
            </div>
            <span className="stat-value">{s.value}</span>
          </article>
        ))}
      </section>

      <div className="flex items-center gap-2">
        <SearchBar
          placeholder="Buscar código, cliente o tipo..."
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
        />
        <span className="badge badge-blue shrink-0">
          <Clock className="w-3.5 h-3.5" />
          {counts.Pendiente}
        </span>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4 animate-pulse" style={{ height: 76 }} />
          ))}
        </div>
      ) : (
        <DataList
          columns={columns}
          rows={paged}
          rowKey={(t) => t.id}
          empty={
            <div className="card">
              <EmptyState icon={<Search size={26} />} title="Sin resultados"
                          description="No se encontraron e-tickets para esta búsqueda" />
            </div>
          }
        />
      )}

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
