import { z } from 'zod';

export const createAccountSchema = z.object({
  banco: z.string().min(1, 'banco es requerido'),
  tipo: z.string().optional(),
  numero: z.string().min(1, 'número es requerido'),
  titular: z.string().optional(),
  activo: z.boolean().optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  banco: z.string().min(1).optional(),
  tipo: z.string().optional(),
  numero: z.string().min(1).optional(),
  titular: z.string().optional(),
  activo: z.boolean().optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
