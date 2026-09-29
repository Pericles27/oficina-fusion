import { z } from 'zod';

export const createCustomerSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido'),
  apellido: z.string().optional(),
  alias: z.string().optional(),
  tipo: z.enum(['Persona', 'Empresa']),
  doc: z.string().optional(),
  custodia: z.string().optional(),
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
  custodia: z.string().optional(),
  notas: z.string().optional(),
  activo: z.boolean().optional(),
  puntosHabituales: z.number().optional(),
});

export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
