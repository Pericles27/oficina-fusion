// =============================================================
// Commission DTOs
// =============================================================

import { z } from 'zod';

export const ComisionMonedaSchema = z.enum(['quote', 'USD'] as const);
export const PricingModeSchema = z.enum(['standard', 'precio_amigo', 'personalizado'] as const);

export const CreateComisionSchema = z.object({
  operadorId: z.string().min(1, 'operadorId es requerido'),
  monto: z.coerce.string().refine(v => Number(v) >= 0, 'monto debe ser >= 0'),
  moneda: ComisionMonedaSchema.default('quote'),
  notas: z.string().optional().nullable(),
});

export type CreateComisionDto = z.infer<typeof CreateComisionSchema>;

export const ComisionFilterSchema = z.object({
  operadorId: z.string().optional(),
  cierreId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
});

export type ComisionFilterDto = z.infer<typeof ComisionFilterSchema>;

// DTO para la respuesta de comisión
export const ComisionResponseSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  opId: z.string().nullable(),
  cableId: z.string().nullable(),
  operadorId: z.string(),
  monto: z.coerce.string(),
  moneda: ComisionMonedaSchema,
  notas: z.string().nullable(),
  cierreId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ComisionResponseDto = z.infer<typeof ComisionResponseSchema>;
