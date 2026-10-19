import { z } from 'zod';

export const createAccountSchema = z.object({
  banco: z.string().min(1, 'banco es requerido'),
  tipo: z.string().optional(),
  numero: z.string().min(1, 'número es requerido'),
  titular: z.string().optional(),
  activo: z.boolean().optional(),
  tipoCuenta: z.enum(['CAJA_AHORRO', 'CUENTA_CORRIENTE']).optional().nullable(),
  numeroCuenta: z.string().optional().nullable(),
  cbu: z.string().min(1, 'cbu debe tener exactamente 22 dígitos').regex(/^[0-9]{22}$/, 'cbu debe tener exactamente 22 dígitos numéricos').optional().nullable(),
  alias: z.string().optional().nullable(),
  cuitTitular: z.string().optional().nullable(),
}).strict();

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  banco: z.string().min(1, 'banco es requerido').optional(),
  tipo: z.string().optional(),
  numero: z.string().min(1, 'número es requerido').optional(),
  titular: z.string().optional(),
  activo: z.boolean().optional(),
  tipoCuenta: z.enum(['CAJA_AHORRO', 'CUENTA_CORRIENTE']).optional().nullable(),
  numeroCuenta: z.string().optional().nullable(),
  cbu: z.string().min(1, 'cbu debe tener exactamente 22 dígitos').regex(/^[0-9]{22}$/, 'cbu debe tener exactamente 22 dígitos numéricos').optional().nullable(),
  alias: z.string().optional().nullable(),
  cuitTitular: z.string().optional().nullable(),
}).strict();

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
