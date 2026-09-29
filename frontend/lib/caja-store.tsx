'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* =============================================================
   Tipos
   ============================================================= */

export type Tipo = 'C' | 'V';
export type CoberturaTipo = 'efectivo' | 'saldo';
export type OpStatus = 'pendiente' | 'ejecucion' | 'finalizada';

export interface Par {
  par: string;
  base: string;
  quote: string;
  nombre: string;
  compra: number;
  venta: number;
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
   Toda operación tiene DOS patas (schema: Eticket.montoEntregar /
   montoRecibir):

     Compra (C): la caja RECIBE base  y ENTREGA quote
     Venta  (V): la caja ENTREGA base y RECIBE  quote

   Cada pata se liquida por un método distinto, y cada método
   pide datos distintos. De ahí que la carga dependa del tipo.
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
  monto: number;
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
export function patasDe(o: { tipo: Tipo; monto: number; contra: number }, par: Par) {
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
  o: { tipo: Tipo; monto: number; contra: number; cobertura: CoberturaTipo },
  par: Par,
  cuenta?: CuentaBancaria
): Pata[] {
  const p = patasDe(o, par);

  const build = (direccion: Direccion, moneda: string, monto: number): Pata => {
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
  monto: number;
  cotiz: number;
  contra: number;
  cobertura: CoberturaTipo;
  status: OpStatus;
  operadorId: string;
  clienteId: string | null;
  cliente: string;
  notas: string | null;
  /** Las dos patas del e-ticket (entregamos / recibimos) */
  patas: Pata[];
  /** Instrucciones generales para el cadete */
  instrucciones: string;
}

interface CajaState {
  diaAbierto: boolean;
  operaciones: Operation[];
  clientes: Cliente[];
  pares: Par[];
  traders: Trader[];
  lastOperadorId: string;
}

export const OP_STATUS_LABEL: Record<OpStatus, string> = {
  pendiente: 'pendiente',
  ejecucion: 'en curso',
  finalizada: 'completada',
};

const STATUS_CYCLE: OpStatus[] = ['pendiente', 'ejecucion', 'finalizada'];

/* =============================================================
   Estado inicial
   ============================================================= */

const PARES: Par[] = [
  { par: 'USD/ARS', base: 'USD', quote: 'ARS', nombre: 'Dólar', compra: 1048, venta: 1052, decimals: 2 },
  { par: 'EUR/ARS', base: 'EUR', quote: 'ARS', nombre: 'Euro', compra: 1138, venta: 1144, decimals: 2 },
  { par: 'USD/BRL', base: 'USD', quote: 'BRL', nombre: 'Dólar/Real', compra: 5.0, venta: 5.2, decimals: 2 },
];

const TRADERS: Trader[] = [
  { id: 't1', name: 'Nicolás García', initials: 'NG', alias: 'Nico', desk: 'Mesa 1', active: true, favorite: true },
  { id: 't2', name: 'María López', initials: 'ML', alias: 'Mari', desk: 'Mesa 1', active: true },
  { id: 't3', name: 'Carlos Pérez', initials: 'CP', desk: 'Mesa 2', active: true },
];

const CLIENTES: Cliente[] = [
  { id: 'c1', nombre: 'Carlos Méndez', doc: '30.456.789', cuentas: [
    { id: 'cu1', banco: 'Galicia', alias: 'carlos.mendez.gal', cbu: '0070999530004512345678', moneda: 'ARS' },
    { id: 'cu2', banco: 'Santander', alias: 'cmendez.san', cbu: '0720123488000012345678', moneda: 'ARS' },
  ] },
  { id: 'c2', nombre: 'Ana Rodríguez', doc: '28.123.456', cuentas: [
    { id: 'cu3', banco: 'BBVA', alias: 'ana.rodriguez', cbu: '0170099220000067890123', moneda: 'ARS' },
  ] },
  { id: 'c3', nombre: 'Miguel Torres', doc: '32.789.012', cuentas: [
    { id: 'cu4', banco: 'Macro', alias: 'mtorres.macro', cbu: '2850590940090418135201', moneda: 'ARS' },
    { id: 'cu5', banco: 'Brubank', alias: 'miguel.torres.bru', cbu: '1430001713008123456789', moneda: 'ARS' },
  ] },
  { id: 'c4', nombre: 'Laura Sánchez', doc: '27.654.321', cuentas: [
    { id: 'cu6', banco: 'Nación', alias: 'laura.sanchez.bna', cbu: '0110599520000012345678', moneda: 'ARS' },
  ] },
];

function hhmm(d = new Date()) {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/** Operaciones de ejemplo para que la planilla no arranque vacía. */
function seedOps(): Operation[] {
  const base: Array<[Tipo, string, number, number, string, string, CoberturaTipo, OpStatus, string]> = [
    ['C', 'USD/ARS', 150000, 1048, 'Carlos Méndez', 'c1', 'efectivo', 'finalizada', '10:32'],
    ['C', 'USD/ARS', 500000, 1049, 'Miguel Torres', 'c3', 'saldo', 'finalizada', '11:48'],
    ['V', 'USD/ARS', 250000, 1052, 'Ana Rodríguez', 'c2', 'efectivo', 'ejecucion', '11:15'],
    ['V', 'USD/ARS', 80000, 1051, 'Laura Sánchez', 'c4', 'efectivo', 'finalizada', '12:02'],
    ['C', 'EUR/ARS', 40000, 1138, 'Ana Rodríguez', 'c2', 'efectivo', 'pendiente', '12:30'],
  ];

  return base.map(([tipo, par, monto, cotiz, cliente, clienteId, cobertura, status, hora], i) => {
    const contra = monto * cotiz;
    const cli = CLIENTES.find((c) => c.id === clienteId);
    const parDef = PARES.find((p) => p.par === par) ?? PARES[0];

    // Las patas se derivan del tipo de operación
    const patas = crearPatas(
      { tipo, monto, contra, cobertura },
      parDef,
      cli?.cuentas?.[0]
    ).map((p) => {
      // Completamos los ejemplos para mostrar el flujo en distintos estados
      if (i === 0 && p.metodo === 'deposito') {
        return {
          ...p,
          nota: 'Depositar antes de las 14:00',
          estado: 'confirmado' as const,
          comprobante: { nombre: 'transferencia-galicia.jpg', dataUrl: '', subidoEl: '10:58' },
        };
      }
      if (i === 0 && p.metodo === 'efectivo') {
        return {
          ...p,
          direccionEntrega: 'Av. Córdoba 1234, piso 8',
          nombreRecibe: 'Carlos Méndez',
          telefono: '11 5544-3322',
          horario: '13:00 a 15:00',
          estado: 'confirmado' as const,
        };
      }
      if (i === 2 && p.metodo === 'deposito') {
        return {
          ...p,
          nota: 'Cliente espera confirmación por WhatsApp',
          estado: 'hecho' as const,
          comprobante: { nombre: 'comprobante-bbva.pdf', dataUrl: '', subidoEl: '11:40' },
        };
      }
      if (i === 2 && p.metodo === 'efectivo') {
        return {
          ...p,
          direccionEntrega: 'Tucumán 540, oficina 3',
          nombreRecibe: 'Ana Rodríguez',
          telefono: '11 4433-2211',
          horario: 'a partir de las 16:00',
        };
      }
      return p;
    });

    return {
      id: `seed-${i}`,
      codigo: `OP-${String(i + 1).padStart(4, '0')}`,
      ts: new Date().toISOString(),
      hora,
      tipo,
      par,
      monto,
      cotiz,
      contra,
      cobertura,
      status,
      operadorId: TRADERS[i % TRADERS.length].id,
      clienteId,
      cliente,
      notas: null,
      patas,
      instrucciones: i === 0 ? 'El cliente retira en oficina; la parte en pesos va a su cuenta.' : '',
    };
  });
}

/* =============================================================
   Contexto
   ============================================================= */

interface CajaContextType {
  state: CajaState;
  dispatch: (action: any) => void;
}

const CajaContext = createContext<CajaContextType | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CajaState>({
    diaAbierto: true,
    operaciones: seedOps(),
    clientes: CLIENTES,
    pares: PARES,
    traders: TRADERS,
    lastOperadorId: 't1',
  });

  const dispatch = useCallback((action: any) => {
    setState((prev) => {
      switch (action.type) {
        case 'ABRIR_DIA':
          return { ...prev, diaAbierto: true };

        case 'CERRAR_DIA':
          return { ...prev, diaAbierto: false };

        case 'ADD_OP': {
          const p = action.payload;
          const contra = p.monto * p.cotiz;
          const cobertura = p.cobertura ?? 'efectivo';
          const parDef = prev.pares.find((x) => x.par === p.par) ?? prev.pares[0];
          const cli = prev.clientes.find((c) => c.id === p.clienteId);

          const nueva: Operation = {
            id: crypto.randomUUID(),
            codigo: `OP-${String(prev.operaciones.length + 1).padStart(4, '0')}`,
            ts: new Date().toISOString(),
            hora: hhmm(),
            tipo: p.tipo,
            par: p.par,
            monto: p.monto,
            cotiz: p.cotiz,
            contra,
            cobertura,
            status: 'pendiente',
            operadorId: p.operadorId,
            clienteId: p.clienteId || null,
            cliente: p.cliente ?? '',
            notas: null,
            // El e-ticket nace ya armado según el tipo de operación
            patas: crearPatas(
              { tipo: p.tipo, monto: p.monto, contra, cobertura },
              parDef,
              cli?.cuentas?.[0]
            ),
            instrucciones: '',
          };
          return {
            ...prev,
            operaciones: [...prev.operaciones, nueva],
            lastOperadorId: p.operadorId || prev.lastOperadorId,
          };
        }

        case 'EDIT_OP': {
          return {
            ...prev,
            operaciones: prev.operaciones.map((o) => {
              if (o.id !== action.id) return o;
              const patched = { ...o, ...action.patch };
              // Recalcular contra si cambió monto o cotización
              if ('monto' in action.patch || 'cotiz' in action.patch) {
                patched.contra = patched.monto * patched.cotiz;

                // Las patas siguen al monto: si nadie las tocó a mano,
                // se reajustan solas para no quedar desfasadas.
                const parDef = prev.pares.find((x) => x.par === patched.par) ?? prev.pares[0];
                const montos = patasDe(patched, parDef);
                patched.patas = patched.patas.map((pata: Pata) => ({
                  ...pata,
                  monto: montos[pata.direccion].monto,
                  moneda: montos[pata.direccion].moneda,
                }));
              }
              return patched;
            }),
          };
        }

        case 'CYCLE_OP_STATUS': {
          return {
            ...prev,
            operaciones: prev.operaciones.map((o) =>
              o.id === action.id
                ? { ...o, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(o.status) + 1) % STATUS_CYCLE.length] }
                : o
            ),
          };
        }

        case 'DELETE_OP':
          return { ...prev, operaciones: prev.operaciones.filter((o) => o.id !== action.id) };

        case 'SET_LAST_OPERADOR':
          return { ...prev, lastOperadorId: action.id };

        case 'SET_PAR_RATE': {
          return {
            ...prev,
            pares: prev.pares.map((p) =>
              p.par === action.par ? { ...p, compra: action.compra, venta: action.venta } : p
            ),
          };
        }

        /* ── Patas del e-ticket ── */

        /** Edita una pata. Al cambiar de método limpia los campos que ya no aplican. */
        case 'EDIT_PATA': {
          const mapPata = (p: Pata): Pata => {
            if (p.id !== action.pataId) return p;
            const next = { ...p, ...action.patch };

            if (action.patch.metodo && action.patch.metodo !== p.metodo) {
              // Campos de efectivo
              delete next.direccionEntrega;
              delete next.nombreRecibe;
              delete next.telefono;
              delete next.horario;
              // Campos de depósito
              delete next.cuentaId;
              delete next.banco;
              delete next.alias;
              // Contra saldo no requiere comprobante: queda saldada
              if (action.patch.metodo === 'saldo') {
                next.estado = 'confirmado';
                next.comprobante = null;
              } else {
                next.estado = 'pendiente';
              }
            }
            return next;
          };

          return {
            ...prev,
            operaciones: prev.operaciones.map((o) =>
              o.id === action.opId ? { ...o, patas: o.patas.map(mapPata) } : o
            ),
          };
        }

        /** El cadete sube (o borra) el comprobante de una pata */
        case 'SET_COMPROBANTE': {
          return {
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
          };
        }

        /** El admin confirma que la pata está correctamente liquidada */
        case 'CONFIRMAR_PATA': {
          return {
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
          };
        }

        case 'SET_INSTRUCCIONES': {
          return {
            ...prev,
            operaciones: prev.operaciones.map((o) =>
              o.id === action.opId ? { ...o, instrucciones: action.texto } : o
            ),
          };
        }

        default:
          return prev;
      }
    });
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <CajaContext.Provider value={value}>{children}</CajaContext.Provider>;
}

export function useCaja() {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error('useCaja debe usarse dentro de CajaProvider');
  return ctx;
}

/* =============================================================
   Selectores / cálculos
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

export function statsForPar(state: CajaState, par: string): ParStats {
  const ops = state.operaciones.filter((o) => o.par === par);
  const compras = ops.filter((o) => o.tipo === 'C');
  const ventas = ops.filter((o) => o.tipo === 'V');

  const sumContra = (arr: Operation[]) => arr.reduce((s, o) => s + o.contra, 0);
  const sumMonto = (arr: Operation[]) => arr.reduce((s, o) => s + o.monto, 0);

  const usados = sumContra(compras);
  const hechos = sumContra(ventas);
  const baseCompra = sumMonto(compras);
  const baseVenta = sumMonto(ventas);

  const promCompra = baseCompra > 0 ? usados / baseCompra : 0;
  const promVenta = baseVenta > 0 ? hechos / baseVenta : 0;

  return {
    par,
    ops,
    compras,
    ventas,
    usados,
    hechos,
    baseCompra,
    baseVenta,
    promCompra,
    promVenta,
    spread: promVenta - promCompra,
    posicion: baseCompra - baseVenta,
  };
}

export interface PosRealizada {
  /** Volumen en base efectivamente calzado (min entre comprado y vendido) */
  matchedBase: number;
  /** Ganancia en moneda quote sobre el volumen calzado */
  realizedQuote: number;
}

/** Ganancia realizada del par: sólo sobre el volumen calzado. */
export function posicionRealizada(state: CajaState, par: string): PosRealizada {
  const s = statsForPar(state, par);
  const matchedBase = Math.min(s.baseCompra, s.baseVenta);
  const realizedQuote = matchedBase * (s.promVenta - s.promCompra);
  return { matchedBase, realizedQuote };
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
  const mid = pdef ? (pdef.compra + pdef.venta) / 2 : 0;

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
