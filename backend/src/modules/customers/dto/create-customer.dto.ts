import { z } from 'zod';
import { CUSTODIAS } from '../saldo';

/** #19: si el saldo del cliente está dentro de la caja o separado. */
const custodia = z.enum(CUSTODIAS);

export const createCustomerSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido'),
  apellido: z.string().optional(),
  alias: z.string().optional(),
  tipo: z.enum(['Persona', 'Empresa']),
  doc: z.string().optional(),
  custodia: custodia.optional(),
  notas: z.string().optional(),
  puntosHabituales: z.number().optional(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().optional(),
  alias: z.string().optional(),
  tipo: z.enum(['Persona', 'Empresa']).optional(),
  doc: z.string().optional(),
  custodia: custodia.optional(),
  notas: z.string().optional(),
  activo: z.boolean().optional(),
  puntosHabituales: z.number().optional(),
});

export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
