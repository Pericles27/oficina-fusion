import { api } from './api';
import type { MonedaCuenta, TipoCuenta } from './customers';

/**
 * E-ticket persistido (C2/C4/C5): una visita (cabecera) + N tramos.
 * Montos siempre como string decimal: el frontend no hace aritmética.
 */

export type TramoSentido = 'ENTREGA' | 'RETIRO';
export type TramoCanal = 'EFECTIVO' | 'DEPOSITO';
export type EticketEstado = 'pendiente' | 'en_curso' | 'confirmado' | 'cancelado';

export const DEP_KEYS = [
  'depBeneficiario', 'depCuit', 'depBanco', 'depTipoCuenta', 'depMonedaCuenta',
  'depNumeroCuenta', 'depCbu', 'depAlias',
] as const;
export type DepKey = (typeof DEP_KEYS)[number];

export interface DepSnapshot {
  depBeneficiario: string | null;
  depCuit: string | null;
  depBanco: string | null;
  depTipoCuenta: TipoCuenta | null;
  depMonedaCuenta: MonedaCuenta | null;
  depNumeroCuenta: string | null;
  depCbu: string | null;
  depAlias: string | null;
}

export interface Tramo extends DepSnapshot {
  id: string;
  orden: number;
  sentido: TramoSentido;
  canal: TramoCanal;
  moneda: string;
  monto: string;
  cuentaDestinoId: string | null;
}

export interface EticketCabecera {
  direccionEntrega: string | null;
  telefonoContacto: string | null;
  nombreRecibe: string | null;
  horarioEntrega: string | null;
  instrucciones: string | null;
}

export interface EticketAdmin extends EticketCabecera {
  id: string;
  numero: number;
  codigo: string;
  estado: EticketEstado;
  clienteId: string;
  operationId: string | null;
  metodoEntrega: 'en_mano' | 'deposito_banco' | 'mixto' | string;
  tramos: Tramo[];
}

/** Lo que ve el cadete: la lista blanca del backend (sin ids de tramo ni FK). */
export interface EticketCadete extends EticketCabecera {
  id: string;
  numero: number;
  codigo: string;
  ts: string;
  estado: EticketEstado;
  metodoEntrega: string;
  tramos: Array<Omit<Tramo, 'id' | 'cuentaDestinoId'>>;
}

export interface TramoInput {
  id?: string;
  orden: number;
  sentido: TramoSentido;
  canal: TramoCanal;
  moneda: string;
  monto: string;
  cuentaDestinoId?: string | null;
  depOverrides?: Partial<DepSnapshot>;
}

export const SENTIDO_LABEL: Record<TramoSentido, string> = {
  ENTREGA: 'Dejar al cliente',
  RETIRO: 'Retirar del cliente',
};

export const METODO_ENTREGA_LABEL: Record<string, string> = {
  en_mano: 'En mano',
  deposito_banco: 'Depósito',
  mixto: 'Mixto',
};

export const ESTADO_LABEL: Record<EticketEstado, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
};

/** Formato de un monto decimal (string) sólo para mostrar; nunca para calcular. */
export function fmtMonto(monto: string, moneda: string): string {
  const [ent, dec = ''] = monto.split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = dec.replace(/0+$/, '');
  return `${moneda} ${miles}${decimales ? `,${decimales}` : ''}`;
}

export const eticketsApi = {
  byOperation: async (operationId: string) =>
    (await api.get<{ data: EticketAdmin[] }>(`/e-tickets?operationId=${encodeURIComponent(operationId)}`)).data[0] ?? null,
  create: (body: Partial<EticketCabecera> & { clienteId: string; operationId?: string; tramos: TramoInput[] }) =>
    api.post<EticketAdmin>('/e-tickets', body),
  update: (id: string, body: Partial<EticketCabecera> & { tramos?: TramoInput[] }) =>
    api.put<EticketAdmin>(`/e-tickets/${id}`, body),
  listCadete: () => api.get<{ data: EticketCadete[]; total: number }>('/e-tickets?pageSize=100'),
  getCadete: (id: string) => api.get<EticketCadete>(`/e-tickets/${id}`),
  confirm: (id: string) => api.post(`/e-tickets/${id}/confirm`),
};
