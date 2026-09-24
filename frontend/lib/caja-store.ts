'use client';

import { ReactNode, createContext, useContext, useState, useCallback } from 'react';

interface CajaState {
  diaAbierto: boolean;
  operaciones: any[];
  comisiones: any[];
  clientes: any[];
  pares: any[];
  traders: any[];
  saldosCliente: any[];
  cables: any[];
  cajaFisica: any;
  cierreTC: number;
}

interface CajaContextType {
  state: CajaState;
  dispatch: React.Dispatch<any>;
}

const CajaContext = createContext<CajaContextType | null>(null);

export function CajaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CajaState>({
    diaAbierto: false,
    operaciones: [],
    comisiones: [],
    clientes: [],
    pares: [
      { par: 'USD/ARS', base: 'USD', quote: 'ARS', nombre: 'Dólar estadounidense', compra: 1540, venta: 1550, decimals: 2 },
      { par: 'USD/BRL', base: 'USD', quote: 'BRL', nombre: 'Dólar/Real', compra: 5.00, venta: 5.20, decimals: 2 },
    ],
    traders: [],
    saldosCliente: [],
    cables: [],
    cajaFisica: { usd100: 0, usdResto: 0, totalArs: 0, totalEur: 0, totalGbp: 0, totalBrl: 0 },
    cierreTC: 0,
  });

  const dispatch = useCallback((action: any) => {
    setState((prev) => {
      switch (action.type) {
        case 'ABRIR_DIA':
          return { ...prev, diaAbierto: true };
        case 'CERRAR_DIA':
          return { ...prev, diaAbierto: false };
        case 'ADD_OP': {
          const newOp = {
            id: crypto.randomUUID(),
            codigo: `OP-${String(prev.operaciones.length + 1).padStart(4, '0')}`,
            ts: new Date().toISOString(),
            tipo: action.payload.tipo,
            parId: action.payload.par,
            par: action.payload.par,
            monto: action.payload.monto,
            cotiz: action.payload.cotiz || 0,
            contra: action.payload.monto * (action.payload.cotiz || 1),
            cobertura: action.payload.cobertura,
            status: 'pendiente',
            operadorId: action.payload.operadorId,
            clienteId: action.payload.clienteId || null,
            cliente: action.payload.cliente || null,
            notas: null,
            cierreId: null,
            comision: null,
          };
          return { ...prev, operaciones: [...prev.operaciones, newOp] };
        }
        case 'EDIT_OP': {
          return {
            ...prev,
            operaciones: prev.operaciones.map((o) =>
              o.id === action.payload.id ? { ...o, ...action.payload.patch } : o,
            ),
          };
        }
        case 'DELETE_OP': {
          return { ...prev, operaciones: prev.operaciones.filter((o) => o.id !== action.payload.id) };
        }
        default:
          return prev;
      }
    });
  }, []);

  return (
    <CajaContext.Provider value={{ state, dispatch }}>
      {children}
    </CajaContext.Provider>
  );
}

export function useCaja() {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error('useCaja must be used within CajaProvider');
  return ctx;
}
