'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth-context';

/* =============================================================
   Tipos
   ============================================================= */

export type Tipo = 'C' | 'V';
export type CoberturaTipo = 'efectivo' | 'saldo';
export type OpStatus = 'pendiente' | 'ejecucion' | 'finalizada';

/** Mapeo de estados: backend usa 'en_ejecucion'/'cancelada', la UI usa 'ejecucion' sin 'cancelada' visible (cancelada se filtra fuera del blotter). */
const STATUS_FROM_API: Record<string, OpStatus> = {
  pendiente: 'pendiente',
  en_ejecucion: 'ejecucion',
  finalizada: 'finalizada',
  cancelada: 'pendiente', // no debería listarse igual, ver filtrado en fetch
};
const STATUS_TO_API: Record<OpStatus, string> = {
  pendiente: 'pendiente',
  ejecucion: 'en_ejecucion',
  finalizada: 'finalizada',
};

export interface Par {
  par: string;
  base: string;
  quote: string;
  nombre: string;
  /** F3: todos los montos viajan como string decimal canónico — cero floats. */
  compra: string;
  venta: string;
  decimals: number;
}

export interface Trader {
  id: string;
  name: string;
  initials: string;
  alias?: string;
  desk: string;
  active: boolean;
  favorite?: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  doc: string;
  /** Cuentas bancarias donde el cliente recibe/envía fondos */
  cuentas?: CuentaBancaria[];
}

export interface CuentaBancaria {
  id: string;
  banco: string;
  alias: string;
  cbu: string;
  moneda: string;
  titular?: string;
}

/* =============================================================
   E-TICKET
   -------------------------------------------------------------
   Desde C4 el e-ticket vive en la API (una visita + N tramos,
   `lib/etickets.ts`); ya no hay "patas" en memoria del navegador.
   Acá sólo queda la sugerencia inicial de tramos según el tipo de
   operación.
   ============================================================= */

export type Direccion = 'entregamos' | 'recibimos';

/** Qué entrega y qué recibe la caja, según el tipo de operación. */
export function patasDe(o: { tipo: Tipo; monto: string; contra: string }, par: Par) {
  return o.tipo === 'C'
    ? {
        recibimos: { moneda: par.base, monto: o.monto },
        entregamos: { moneda: par.quote, monto: o.contra },
      }
    : {
        entregamos: { moneda: par.base, monto: o.monto },
        recibimos: { moneda: par.quote, monto: o.contra },
      };
}

export interface Operation {
  id: string;
  codigo: string;
  ts: string;
  hora: string;
  tipo: Tipo;
  par: string;
  /** F3: campos monetarios como string decimal canónico — nunca número. */
  monto: string;
  cotiz: string;
  contra: string;
  cobertura: CoberturaTipo;
  status: OpStatus;
  operadorId: string;
  clienteId: string | null;
  cliente: string;
  notas: string | null;
}

/**
 * KPI de un par, tal como lo devuelve GET /operations/kpis/par (aggregateByPar, B2).
 * Las cifras exactas vienen como string decimal; los number son sólo para mostrar.
 */
export interface KpiPar {
  par: string;
  totalCompras: number;
  totalVentas: number;
  compraPromedio: number;
  ventaPromedio: number;
  volumenTotalUsd: number;
  nOps: number;
  /** promVenta − promCompra, en quote por unidad de base. */
  spread: string;
  matchedBase: string;
  /** Resultado por spread sobre el volumen calzado, en quote. */
  realizedQuote: string;
  spreadUsd: string;
  comisionesUsd: string;
  /** Ganancia = spread − comisiones, en USD (U1). */
  gananciaUsd: string;
}

export interface KpiOperador {
  operadorId: string;
  operadorNombre: string;
  nOps: number;
  totalCompras: number;
  totalVentas: number;
  volumenTotalUsd: number;
  gananciaUsd: number;
  comisionesUsd: number;
}

interface CajaState {
  diaAbierto: boolean;
  operaciones: Operation[];
  clientes: Cliente[];
  pares: Par[];
  traders: Trader[];
  lastOperadorId: string;
  /** F3: KPIs calculados por el backend — cero aritmética financiera en el cliente. */
  kpisPar: KpiPar[];
  kpisOperador: KpiOperador[];
}

export const OP_STATUS_LABEL: Record<OpStatus, string> = {
  pendiente: 'pendiente',
  ejecucion: 'en curso',
  finalizada: 'completada',
};

const STATUS_CYCLE: OpStatus[] = ['pendiente', 'ejecucion', 'finalizada'];

const EMPTY_STATE: CajaState = {
  diaAbierto: true,
  operaciones: [],
  clientes: [],
  pares: [],
  traders: [],
  lastOperadorId: '',
  kpisPar: [],
  kpisOperador: [],
};

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Error de red';
}

/* =============================================================
   Mapeo API → modelo de UI
   ============================================================= */

/** Shape mínimo que necesitamos de la Operacion que devuelve el backend. */
interface ApiOperacion {
  id: string;
  codigo: string;
  numero: number;
  ts: string;
  tipo: Tipo;
  parId: string;
  monto: string;
  cotiz: string;
  contra: string;
  cobertura: CoberturaTipo;
  status: string;
  operadorId: string;
  clienteId: string | null;
  cliente?: { nombre: string; apellido?: string | null } | null;
  operador?: { id: string; nombre: string } | null;
  notas: string | null;
}

interface ApiPar {
  par: string;
  base: string;
  quote: string;
  nombre: string;
  compra: string;
  venta: string;
  decimals: number;
}

interface ApiCliente {
  id: string;
  nombre: string;
  apellido?: string | null;
  doc?: string | null;
  cuentas?: Array<{ id: string; banco: string; alias: string; numero: string; moneda?: string | null }>;
}

function parFromApi(p: ApiPar): Par {
  return {
    par: p.par,
    base: p.base,
    quote: p.quote,
    nombre: p.nombre,
    compra: p.compra,
    venta: p.venta,
    decimals: p.decimals,
  };
}

/** Par predeterminado de la mesa (el más operado): va primero en tabs y selección. */
export const PAR_PREDETERMINADO = 'USD/ARS';

/** Pares desde la API (orden alfabético) con el predeterminado primero. */
function paresFromApi(ps: ApiPar[]): Par[] {
  const pares = ps.map(parFromApi);
  return [
    ...pares.filter((p) => p.par === PAR_PREDETERMINADO),
    ...pares.filter((p) => p.par !== PAR_PREDETERMINADO),
  ];
}

function clienteFromApi(c: ApiCliente): Cliente {
  return {
    id: c.id,
    nombre: c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre,
    doc: c.doc ?? '',
    cuentas: (c.cuentas ?? []).map((cu) => ({
      id: cu.id,
      banco: cu.banco,
      alias: cu.alias,
      cbu: cu.numero,
      moneda: cu.moneda ?? 'ARS',
    })),
  };
}

/** #20: la Mesa muestra las operaciones en el orden en que se cargaron (la primera arriba).
    La API las devuelve de la más nueva a la más vieja; `numero` es correlativo de carga. */
function enOrdenDeCarga(ops: ApiOperacion[]): ApiOperacion[] {
  return [...ops].sort((a, b) => a.numero - b.numero);
}

/** Convierte una Operacion de la API al shape de UI. */
function operationFromApi(o: ApiOperacion, clientes: Cliente[]): Operation {
  const cli = o.clienteId ? clientes.find((c) => c.id === o.clienteId) : undefined;
  const nombreCliente = o.cliente
    ? o.cliente.apellido
      ? `${o.cliente.nombre} ${o.cliente.apellido}`
      : o.cliente.nombre
    : cli?.nombre ?? '';

  return {
    id: o.id,
    codigo: o.codigo,
    ts: o.ts,
    hora: hhmm(o.ts),
    tipo: o.tipo,
    par: o.parId,
    monto: o.monto,
    cotiz: o.cotiz,
    contra: o.contra,
    cobertura: o.cobertura,
    status: STATUS_FROM_API[o.status] ?? 'pendiente',
    operadorId: o.operadorId,
    clienteId: o.clienteId,
    cliente: nombreCliente,
    notas: o.notas,
  };
}

/* =============================================================
   Contexto
   ============================================================= */

/** Payload de ADD_OP — el cliente puede venir como nombre visible (texto)
    o como FK (clienteId), o ambos. B1: si el nombre existe pero el ID no,
    se rechaza antes de POST para no perder el cliente silenciosamente. */
export interface AddOpPayload {
  tipo: Tipo;
  par: string;
  monto: string | number;
  cotiz?: string | number;
  cobertura?: CoberturaTipo;
  clienteId?: string;
  /** Nombre visible del cliente (texto libre). Si viene, clienteId es obligatorio. */
  cliente?: string;
  operadorId?: string;
}

interface CajaContextType {
  state: CajaState;
  /** Dispatch de acciones del caja-store. Usar las interfaces exportadas
      (AddOpPayload) para los payloads; el resto se tipa por estructura. */
  dispatch: (action: Record<string, unknown>) => void;
  /** Agregados, opcionales de consumir — no cambian el contrato existente. */
  loading: boolean;
  error: string | null;
}

const CajaContext = createContext<CajaContextType | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CajaState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Referencia mutable al state para que el dispatch (useCallback sin
  // deps de state) siempre lea el valor más reciente sin tener que
  // recrearse en cada render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const refetchOperaciones = useCallback(async () => {
    const res = await api.get<{ data: ApiOperacion[] }>('/operations?pageSize=200');
    setState((prev) => ({
      ...prev,
      operaciones: enOrdenDeCarga(res.data)
        .filter((o) => o.status !== 'cancelada')
        .map((o) => operationFromApi(o, prev.clientes)),
    }));
  }, []);

  const refetchKpis = useCallback(async () => {
    try {
      const [kpisPar, kpisOperador] = await Promise.all([
        api.get<{ stats: KpiPar[] }>('/operations/kpis/par'),
        api.get<{ stats: KpiOperador[] }>('/operations/kpis/operador'),
      ]);
      setState((prev) => ({ ...prev, kpisPar: kpisPar.stats, kpisOperador: kpisOperador.stats }));
    } catch {
      // Los KPIs son complementarios — si fallan, no bloqueamos la carga
      // principal de la mesa.
    }
  }, []);

  // Carga inicial: sólo con sesión de mesa. Sin usuario (p. ej. en /login) cada
  // request daría 401 y el cliente HTTP redirigiría a /login en bucle. Se
  // repite al cambiar de usuario, así el login no deja la mesa vacía.
  // La mesa (operaciones, KPIs) es sólo de ADMIN/OPERADOR: un cadete recibiría 403.
  const { user } = useAuth();
  const userId = user && user.roles.some((r) => r === 'ADMIN' || r === 'OPERADOR') ? user.id : undefined;
  useEffect(() => {
    if (!userId) {
      setState(EMPTY_STATE);
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [paresRes, clientesRes, opsRes] = await Promise.all([
          api.get<ApiPar[]>('/quotations'),
          api.get<{ data: ApiCliente[] }>('/customers?activo=true&pageSize=200'),
          api.get<{ data: ApiOperacion[] }>('/operations?pageSize=200'),
        ]);
        if (cancelado) return;

        const pares = paresFromApi(paresRes);
        const clientes = clientesRes.data.map(clienteFromApi);
        const operaciones = enOrdenDeCarga(opsRes.data)
          .filter((o) => o.status !== 'cancelada')
          .map((o) => operationFromApi(o, clientes));

        // "traders": no hay GET /users para OPERADOR (ADMIN-only). El
        // nombre de cada operador viaja en la propia Operacion — se arma
        // la lista de traders a partir de los operadores que aparecen en
        // las operaciones del día (R5 de ANALISIS-FASES-3-4-5.md).
        const tradersMap = new Map<string, Trader>();
        for (const o of opsRes.data) {
          if (o.operador && !tradersMap.has(o.operador.id)) {
            tradersMap.set(o.operador.id, {
              id: o.operador.id,
              name: o.operador.nombre,
              initials: o.operador.nombre
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase(),
              desk: 'Mesa 1',
              active: true,
            });
          }
        }

        setState({
          diaAbierto: true,
          operaciones,
          clientes,
          pares,
          traders: Array.from(tradersMap.values()),
          lastOperadorId: operaciones[operaciones.length - 1]?.operadorId ?? '',
          kpisPar: [],
          kpisOperador: [],
        });

        void refetchKpis();
      } catch (e) {
        if (!cancelado) setError(mensajeDe(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [refetchKpis, userId]);

  const dispatch = useCallback(
    (action: any) => {
      // La mayoría de las acciones son async contra la API; la firma
      // pública sigue devolviendo void (igual que antes), el await vive
      // adentro. Ver ANALISIS-FASES-3-4-5.md §1.
      void (async () => {
        try {
          switch (action.type) {
            case 'ABRIR_DIA':
              setState((prev) => ({ ...prev, diaAbierto: true }));
              return;

            case 'CERRAR_DIA':
              setState((prev) => ({ ...prev, diaAbierto: false }));
              return;

            case 'ADD_OP': {
              const p = action.payload as AddOpPayload;

              // B1: si el payload trae nombre de cliente (texto) pero no
              // clienteId (FK), NO se llama POST — el cliente se perdería
              // silenciosamente. Se expone un error visible en el store.
              if (p.cliente && !p.clienteId) {
                setError(
                  `«${p.cliente}» no es un cliente cargado: elegilo de la lista o crealo. ` +
                    'Una operación sin clienteId perdería el cliente.',
                );
                return;
              }

              try {
                await api.post('/operations', {
                  tipo: p.tipo,
                  parId: p.par,
                  monto: String(p.monto),
                  cotiz: p.cotiz != null ? String(p.cotiz) : undefined,
                  cobertura: p.cobertura ?? 'efectivo',
                  clienteId: p.clienteId || undefined,
                });
                setError(null); // limpiar error previo en éxito
                await refetchOperaciones();
                await refetchKpis();
                if (p.operadorId) {
                  const operadorId = p.operadorId;
                  setState((prev) => ({ ...prev, lastOperadorId: operadorId }));
                }
              } catch (e) {
                setError(mensajeDe(e));
              }
              return;
            }

            case 'ADD_CLIENTE':
              // B3: cliente recién creado desde la planilla (ya persistido con POST /customers).
              setState((prev) => ({ ...prev, clientes: [action.cliente, ...prev.clientes] }));
              return;

            case 'REMOVE_CLIENTE':
              // Cliente dado de baja desde Clientes: deja de ofrecerse en la planilla.
              setState((prev) => ({ ...prev, clientes: prev.clientes.filter((c) => c.id !== action.id) }));
              return;

            case 'EDIT_OP': {
              const patch: Record<string, unknown> = {};
              if ('clienteId' in action.patch) patch.clienteId = action.patch.clienteId;
              if ('monto' in action.patch) patch.monto = String(action.patch.monto);
              if ('cotiz' in action.patch) patch.cotiz = String(action.patch.cotiz);
              if ('cobertura' in action.patch) patch.cobertura = action.patch.cobertura;
              if ('notas' in action.patch) patch.notas = action.patch.notas;

              // 'cliente' (nombre de texto libre) no tiene equivalente en
              // el backend — Operacion sólo guarda clienteId (FK). Si
              // sólo se edita el nombre a mano (como hace la planilla hoy
              // con el datalist), lo reflejamos en memoria nomás; no hay
              // endpoint para "renombrar cliente de una operación suelta".
              if ('cliente' in action.patch && Object.keys(patch).length === 0) {
                setState((prev) => ({
                  ...prev,
                  operaciones: prev.operaciones.map((o) =>
                    o.id === action.id ? { ...o, cliente: action.patch.cliente } : o
                  ),
                }));
                return;
              }

              if (Object.keys(patch).length > 0) {
                await api.put(`/operations/${action.id}`, patch);
                await refetchOperaciones();
                await refetchKpis();
              }
              return;
            }

            case 'CYCLE_OP_STATUS': {
              const current = stateRef.current.operaciones.find((o) => o.id === action.id);
              if (!current) return;
              const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current.status) + 1) % STATUS_CYCLE.length];
              if (next === 'finalizada') {
                await api.post(`/operations/${action.id}/finalize`);
              } else if (next === 'ejecucion') {
                await api.put(`/operations/${action.id}`, { status: STATUS_TO_API.ejecucion });
              } else {
                await api.put(`/operations/${action.id}`, { status: STATUS_TO_API.pendiente });
              }
              await refetchOperaciones();
              await refetchKpis();
              return;
            }

            case 'DELETE_OP': {
              // No existe DELETE /operations/:id (inmutabilidad post-cierre
              // es la regla del dominio) — "eliminar" desde la planilla es
              // cancelar.
              await api.post(`/operations/${action.id}/cancel`);
              await refetchOperaciones();
              await refetchKpis();
              return;
            }

            case 'SET_LAST_OPERADOR':
              setState((prev) => ({ ...prev, lastOperadorId: action.id }));
              return;

            case 'SET_PAR_RATE': {
              const [base, quote] = action.par.split('/');
              await api.put(`/quotations/${base}/${quote}`, {
                compra: String(action.compra),
                venta: String(action.venta),
              });
              const pares = await api.get<ApiPar[]>('/quotations');
              setState((prev) => ({ ...prev, pares: paresFromApi(pares) }));
              return;
            }

            default:
              return;
          }
        } catch (e) {
          setError(mensajeDe(e));
        }
      })();
    },
    [refetchOperaciones, refetchKpis]
  );

  const value = useMemo(() => ({ state, dispatch, loading, error }), [state, dispatch, loading, error]);

  return <CajaContext.Provider value={value}>{children}</CajaContext.Provider>;
}

export function useCaja() {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error('useCaja debe usarse dentro de CajaProvider');
  return ctx;
}

/* =============================================================
   Selectores / cálculos
   -------------------------------------------------------------
   F3: statsForPar/posicionRealizada YA NO CALCULAN NADA sobre
   floats. Son adaptadores de lectura sobre los KPIs que manda el
   backend (GET /operations/kpis/par), que calcula con decimal.js
   precisión 30 + ROUND_HALF_EVEN. Cero aritmética financiera acá.
   ============================================================= */

export interface ParStats {
  par: string;
  ops: Operation[];
  compras: Operation[];
  ventas: Operation[];
  /** Total en quote gastado comprando */
  usados: number;
  /** Total en quote recibido vendiendo */
  hechos: number;
  baseCompra: number;
  baseVenta: number;
  promCompra: number;
  promVenta: number;
  spread: number;
  /** Posición neta en base (compras − ventas) */
  posicion: number;
}

const EMPTY_KPI_PAR: Omit<KpiPar, 'par'> = {
  totalCompras: 0,
  totalVentas: 0,
  compraPromedio: 0,
  ventaPromedio: 0,
  volumenTotalUsd: 0,
  nOps: 0,
  spread: '0',
  matchedBase: '0',
  realizedQuote: '0',
  spreadUsd: '0',
  comisionesUsd: '0',
  gananciaUsd: '0',
};

export function statsForPar(state: CajaState, par: string): ParStats {
  const ops = state.operaciones.filter((o) => o.par === par);
  const compras = ops.filter((o) => o.tipo === 'C');
  const ventas = ops.filter((o) => o.tipo === 'V');

  const kpi = state.kpisPar.find((k) => k.par === par) ?? { par, ...EMPTY_KPI_PAR };

  return {
    par,
    ops,
    compras,
    ventas,
    usados: kpi.totalCompras * kpi.compraPromedio,
    hechos: kpi.totalVentas * kpi.ventaPromedio,
    baseCompra: kpi.totalCompras,
    baseVenta: kpi.totalVentas,
    promCompra: kpi.compraPromedio,
    promVenta: kpi.ventaPromedio,
    spread: Number(kpi.spread),
    posicion: kpi.totalCompras - kpi.totalVentas,
  };
}

export interface PosRealizada {
  /** Volumen en base efectivamente calzado (min entre comprado y vendido) */
  matchedBase: number;
  /** Ganancia en moneda quote sobre el volumen calzado */
  realizedQuote: number;
}

/** Ganancia realizada del par — leída directo del KPI del backend. */
export function posicionRealizada(state: CajaState, par: string): PosRealizada {
  const kpi = state.kpisPar.find((k) => k.par === par);
  if (!kpi) return { matchedBase: 0, realizedQuote: 0 };
  return { matchedBase: Number(kpi.matchedBase), realizedQuote: Number(kpi.realizedQuote) };
}

export interface PosAbierta {
  /** Exposición neta en base; positiva = LONG, negativa = SHORT */
  base: number;
  isLong: boolean;
  /** Valor aproximado en quote usando la cotización vigente */
  valorQuote: number;
}

const POS_ABIERTA_UMBRAL = 0.5;

/** Posición sin calzar del par. null = calzada. */
export function posicionAbierta(state: CajaState, par: string): PosAbierta | null {
  const s = statsForPar(state, par);
  if (s.ops.length === 0) return null;

  const neto = s.baseCompra - s.baseVenta;
  if (Math.abs(neto) < POS_ABIERTA_UMBRAL) return null;

  const pdef = state.pares.find((p) => p.par === par);
  const mid = pdef ? (Number(pdef.compra) + Number(pdef.venta)) / 2 : 0;

  return { base: neto, isLong: neto > 0, valorQuote: Math.abs(neto) * mid };
}

export function traderById(state: CajaState, id: string): Trader | undefined {
  return state.traders.find((t) => t.id === id);
}

export function clienteById(state: CajaState, id: string | null): Cliente | undefined {
  return id ? state.clientes.find((c) => c.id === id) : undefined;
}
