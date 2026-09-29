import { z } from 'zod';

export const createPhoneSchema = z.object({
  numero: z.string().min(1, 'número es requerido'),
  tipo: z.string().optional(),
  principal: z.boolean().optional(),
});

export type CreatePhoneDto = z.infer<typeof createPhoneSchema>;

export const updatePhoneSchema = z.object({
  numero: z.string().min(1).optional(),
  tipo: z.string().optional(),
  principal: z.boolean().optional(),
});

export type UpdatePhoneDto = z.infer<typeof updatePhoneSchema>;
