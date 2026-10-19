import { api } from './api';

/**
 * Tipos y llamadas de clientes, tal como los expone `/customers` (C2/C3).
 * Sin datos de saldo: la UI de clientes no los muestra.
 */

export type ClienteTipo = 'Persona' | 'Empresa';
export type TipoCuenta = 'CAJA_AHORRO' | 'CUENTA_CORRIENTE';
export type MonedaCuenta = 'ARS' | 'USD';

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  alias: string | null;
  tipo: ClienteTipo;
  doc: string | null;
  notas: string | null;
  activo: boolean;
  createdAt: string;
}

export interface ClienteDireccion {
  id: string;
  direccion: string;
  tipo: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigoPost: string | null;
  principal: boolean;
}

export interface CuentaCliente {
  id: string;
  banco: string;
  numero: string;
  titular: string | null;
  activo: boolean;
  tipoCuenta: TipoCuenta | null;
  monedaCuenta: MonedaCuenta | null;
  numeroCuenta: string | null;
  cbu: string | null;
  alias: string | null;
  cuitTitular: string | null;
}

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = {
  CAJA_AHORRO: 'Caja de ahorro',
  CUENTA_CORRIENTE: 'Cuenta corriente',
};

export function nombreCliente(c: Pick<Cliente, 'nombre' | 'apellido'>): string {
  return [c.nombre, c.apellido].filter(Boolean).join(' ');
}

/** Resumen corto de una cuenta para selectores: "Banco · Caja de ahorro ARS · 0001…". */
export function resumenCuenta(c: CuentaCliente): string {
  const tipo = c.tipoCuenta ? TIPO_CUENTA_LABEL[c.tipoCuenta] : 'Cuenta';
  const id = c.numeroCuenta || c.cbu || c.alias || c.numero;
  return `${c.banco} · ${tipo}${c.monedaCuenta ? ` ${c.monedaCuenta}` : ''} · ${id}`;
}

export const customersApi = {
  list: (q = '', pageSize = 50) =>
    api.get<{ data: Cliente[]; total: number }>(
      `/customers?pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  create: (body: { nombre: string; apellido?: string; tipo: ClienteTipo; doc?: string; notas?: string }) =>
    api.post<Cliente>('/customers', body),
  update: (id: string, body: Partial<Pick<Cliente, 'nombre' | 'apellido' | 'tipo' | 'doc' | 'notas' | 'activo'>>) =>
    api.put<Cliente>(`/customers/${id}`, body),
  addresses: (id: string) => api.get<ClienteDireccion[]>(`/customers/${id}/addresses`),
  addAddress: (id: string, body: { direccion: string; ciudad?: string; provincia?: string; codigoPost?: string; principal: boolean }) =>
    api.post<ClienteDireccion>(`/customers/${id}/addresses`, body),
  removeAddress: (id: string, addressId: string) => api.delete(`/customers/${id}/addresses/${addressId}`),
  accounts: (id: string) => api.get<CuentaCliente[]>(`/customers/${id}/accounts`),
  addAccount: (id: string, body: Omit<CuentaCliente, 'id' | 'activo' | 'titular'> & { titular?: string }) =>
    api.post<CuentaCliente>(`/customers/${id}/accounts`, body),
  removeAccount: (id: string, accountId: string) => api.delete(`/customers/${id}/accounts/${accountId}`),
};
