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
   E-TICKET — modelo por tipo de operación
   -------------------------------------------------------------
   LIMITACIÓN CONOCIDA (reportada en el entregable de Fase 3):
   el backend modela el e-ticket como una entidad PLANA (`Eticket`):
   un método de entrega, un monto a entregar y uno a recibir. El
   modelo de UI de abajo (dos "patas" con comprobante en dataURL,
   estado propio por tramo, método por tramo) no tiene un endpoint
   equivalente — no existe `POST /e-tickets/:id/patas` ni nada que
   reciba un dataURL de comprobante.

   Decisión tomada (bajo nivel, documentada para auditoría): las
   PATAS siguen viviendo en memoria local del store, derivadas de
   `Operation` al crearse (igual que antes), y las acciones que las
   tocan (EDIT_PATA, SET_COMPROBANTE, CONFIRMAR_PATA,
   SET_INSTRUCCIONES) actualizan sólo el estado local — NO llaman a
   la API todavía. Esto significa que el detalle del e-ticket (quién
   recibe, comprobante subido, etc.) NO sobrevive un F5 hoy. Persiste
   sí: la operación en sí (monto, cotización, estado, cliente).

   Para completar esto hace falta definir el contrato
   POST/PUT /e-tickets con la forma de "dos tramos" — eso es una
   decisión de modelo de datos que no me corresponde inventar en
   silencio (igual que B2 del análisis del Arquitecto). Reportado.
   ============================================================= */

export type Direccion = 'entregamos' | 'recibimos';

export type MetodoPata =
  | 'efectivo'   // en mano: hace falta dirección, contacto y horario
  | 'deposito'   // banco: hace falta cuenta destino + comprobante
  | 'saldo';     // contra saldo del cliente: no hay movimiento físico

export const METODO_LABEL: Record<MetodoPata, string> = {
  efectivo: 'Efectivo en mano',
  deposito: 'Depósito bancario',
  saldo: 'Contra saldo',
};

export type PataEstado = 'pendiente' | 'hecho' | 'confirmado';

export interface Comprobante {
  nombre: string;
  dataUrl: string;
  subidoEl: string;
}

/**
 * Una pata del e-ticket. Los campos opcionales aplican según `metodo`:
 *  - efectivo → direccionEntrega, nombreRecibe, telefono, horario
 *  - deposito → cuentaId, banco, alias
 *  - saldo    → ninguno (se salda contra la cuenta corriente del cliente)
 */
export interface Pata {
  id: string;
  direccion: Direccion;
  moneda: string;
  /** F3: string decimal canónico. */
  monto: string;
  metodo: MetodoPata;

  // efectivo en mano
  direccionEntrega?: string;
  nombreRecibe?: string;
  telefono?: string;
  horario?: string;

  // depósito bancario
  cuentaId?: string | null;
  banco?: string;
  alias?: string;

  nota: string;
  estado: PataEstado;
  comprobante?: Comprobante | null;
}

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

/** Método sugerido: ARS suele ir por banco, la divisa en mano. */
function metodoSugerido(moneda: string, cobertura: CoberturaTipo): MetodoPata {
  if (cobertura === 'saldo') return 'saldo';
  return moneda === 'ARS' ? 'deposito' : 'efectivo';
}

/** Crea las dos patas iniciales de una operación. */
export function crearPatas(
  o: { tipo: Tipo; monto: string; contra: string; cobertura: CoberturaTipo },
  par: Par,
  cuenta?: CuentaBancaria
): Pata[] {
  const p = patasDe(o, par);

  const build = (direccion: Direccion, moneda: string, monto: string): Pata => {
    const metodo = metodoSugerido(moneda, o.cobertura);
    return {
      id: `${direccion}-${Math.random().toString(36).slice(2, 9)}`,
      direccion,
      moneda,
      monto,
      metodo,
      nota: '',
      estado: metodo === 'saldo' ? 'confirmado' : 'pendiente',
      comprobante: null,
      ...(metodo === 'deposito' && cuenta?.moneda === moneda
        ? { cuentaId: cuenta.id, banco: cuenta.banco, alias: cuenta.alias }
        : {}),
    };
  };

  return [
    build('entregamos', p.entregamos.moneda, p.entregamos.monto),
    build('recibimos', p.recibimos.moneda, p.recibimos.monto),
  ];
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
  /** Las dos patas del e-ticket (entregamos / recibimos) — ver nota arriba: viven sólo en memoria local. */
  patas: Pata[];
  /** Instrucciones generales para el cadete — también sólo en memoria local por ahora. */
  instrucciones: string;
}

/** KPI de un par, tal como lo devuelve GET /operations/kpis/par (aggregateByPar). */
export interface KpiPar {
  par: string;
  totalCompras: number;
  totalVentas: number;
  compraPromedio: number;
  ventaPromedio: number;
  spreadPromedio: number;
  volumenTotalUsd: number;
  nOps: number;
  gananciaEstimadaUsd: number;
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

/** Convierte una Operacion de la API al shape de UI, generando patas en memoria. */
function operationFromApi(o: ApiOperacion, pares: Par[], clientes: Cliente[], existing?: Operation): Operation {
  const parDef = pares.find((p) => p.par === o.parId) ?? pares[0];
  const cli = o.clienteId ? clientes.find((c) => c.id === o.clienteId) : undefined;
  const nombreCliente = o.cliente
    ? o.cliente.apellido
      ? `${o.cliente.nombre} ${o.cliente.apellido}`
      : o.cliente.nombre
    : cli?.nombre ?? '';

  // Si ya teníamos esta operación en memoria, conservamos sus patas e
  // instrucciones (viven sólo local, ver nota de limitación arriba) en
  // vez de regenerarlas en cada refetch — si no, se perdería lo que el
  // cadete/admin cargó a mano en la sesión actual.
  if (existing && existing.id === o.id) {
    return {
      ...existing,
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

  const patas = parDef
    ? crearPatas(
        { tipo: o.tipo, monto: o.monto, contra: o.contra, cobertura: o.cobertura },
        parDef,
        cli?.cuentas?.[0]
      )
    : [];

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
    patas,
    instrucciones: '',
  };
}

/* =============================================================
   Contexto
   ============================================================= */

interface CajaContextType {
  state: CajaState;
  dispatch: (action: any) => void;
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
      operaciones: res.data
        .filter((o) => o.status !== 'cancelada')
        .map((o) => operationFromApi(o, prev.pares, prev.clientes, prev.operaciones.find((x) => x.id === o.id))),
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

  // Carga inicial
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [paresRes, clientesRes, opsRes] = await Promise.all([
          api.get<ApiPar[]>('/quotations'),
          api.get<{ data: ApiCliente[] }>('/customers?pageSize=200'),
          api.get<{ data: ApiOperacion[] }>('/operations?pageSize=200'),
        ]);
        if (cancelado) return;

        const pares = paresRes.map(parFromApi);
        const clientes = clientesRes.data.map(clienteFromApi);
        const operaciones = opsRes.data
          .filter((o) => o.status !== 'cancelada')
          .map((o) => operationFromApi(o, pares, clientes));

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
          lastOperadorId: operaciones[0]?.operadorId ?? '',
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
  }, [refetchKpis]);

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
              const p = action.payload;
              await api.post('/operations', {
                tipo: p.tipo,
                parId: p.par,
                monto: String(p.monto),
                cotiz: p.cotiz != null ? String(p.cotiz) : undefined,
                cobertura: p.cobertura ?? 'efectivo',
                clienteId: p.clienteId || undefined,
              });
              await refetchOperaciones();
              await refetchKpis();
              if (p.operadorId) {
                setState((prev) => ({ ...prev, lastOperadorId: p.operadorId }));
              }
              return;
            }

            case 'EDIT_OP': {
              const patch: Record<string, unknown> = {};
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
              setState((prev) => ({ ...prev, pares: pares.map(parFromApi) }));
              return;
            }

            /* ── Patas del e-ticket — sólo memoria local, ver nota de
               limitación conocida al tope del archivo. No hay endpoint
               de backend equivalente todavía. ── */

            case 'EDIT_PATA': {
              const mapPata = (p: Pata): Pata => {
                if (p.id !== action.pataId) return p;
                const next = { ...p, ...action.patch };

                if (action.patch.metodo && action.patch.metodo !== p.metodo) {
                  delete next.direccionEntrega;
                  delete next.nombreRecibe;
                  delete next.telefono;
                  delete next.horario;
                  delete next.cuentaId;
                  delete next.banco;
                  delete next.alias;
                  if (action.patch.metodo === 'saldo') {
                    next.estado = 'confirmado';
                    next.comprobante = null;
                  } else {
                    next.estado = 'pendiente';
                  }
                }
                return next;
              };

              setState((prev) => ({
                ...prev,
                operaciones: prev.operaciones.map((o) =>
                  o.id === action.opId ? { ...o, patas: o.patas.map(mapPata) } : o
                ),
              }));
              return;
            }

            case 'SET_COMPROBANTE': {
              setState((prev) => ({
                ...prev,
                operaciones: prev.operaciones.map((o) =>
                  o.id === action.opId
                    ? {
                        ...o,
                        patas: o.patas.map((p) =>
                          p.id === action.pataId
                            ? {
                                ...p,
                                comprobante: action.comprobante,
                                estado: (action.comprobante ? 'hecho' : 'pendiente') as PataEstado,
                              }
                            : p
                        ),
                      }
                    : o
                ),
              }));
              return;
            }

            case 'CONFIRMAR_PATA': {
              setState((prev) => ({
                ...prev,
                operaciones: prev.operaciones.map((o) =>
                  o.id === action.opId
                    ? {
                        ...o,
                        patas: o.patas.map((p) =>
                          p.id === action.pataId ? { ...p, estado: 'confirmado' as PataEstado } : p
                        ),
                      }
                    : o
                ),
              }));
              return;
            }

            case 'SET_INSTRUCCIONES': {
              setState((prev) => ({
                ...prev,
                operaciones: prev.operaciones.map((o) =>
                  o.id === action.opId ? { ...o, instrucciones: action.texto } : o
                ),
              }));
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
  spreadPromedio: 0,
  volumenTotalUsd: 0,
  nOps: 0,
  gananciaEstimadaUsd: 0,
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
    spread: kpi.spreadPromedio,
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
  const matchedBase = Math.min(kpi.totalCompras, kpi.totalVentas);
  return { matchedBase, realizedQuote: kpi.gananciaEstimadaUsd };
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

/** Qué campos necesita cada método para considerarse completo. */
export function camposFaltantes(p: Pata): string[] {
  const falta: string[] = [];
  if (p.metodo === 'efectivo') {
    if (!p.direccionEntrega?.trim()) falta.push('dirección');
    if (!p.nombreRecibe?.trim()) falta.push('quién recibe');
    if (!p.telefono?.trim()) falta.push('teléfono');
  }
  if (p.metodo === 'deposito') {
    if (!p.cuentaId && !p.banco?.trim()) falta.push('cuenta destino');
  }
  return falta;
}

export interface ResumenTicket {
  /** Patas que el cadete todavía tiene que ejecutar */
  pendientes: number;
  /** Patas ya ejecutadas, esperando confirmación del admin */
  hechas: number;
  confirmadas: number;
  total: number;
  /** Patas a las que les falta algún dato para poder ejecutarse */
  incompletas: number;
  /** true si el e-ticket está listo para mandarse al cadete */
  listoParaCadete: boolean;
  /** true si todas las patas están confirmadas */
  completo: boolean;
}

export function resumenTicket(o: Operation): ResumenTicket {
  const incompletas = o.patas.filter((p) => camposFaltantes(p).length > 0).length;
  const pendientes = o.patas.filter((p) => p.estado === 'pendiente').length;
  const hechas = o.patas.filter((p) => p.estado === 'hecho').length;
  const confirmadas = o.patas.filter((p) => p.estado === 'confirmado').length;

  return {
    pendientes,
    hechas,
    confirmadas,
    total: o.patas.length,
    incompletas,
    listoParaCadete: incompletas === 0 && o.patas.length > 0,
    completo: o.patas.length > 0 && confirmadas === o.patas.length,
  };
}
