import { z } from 'zod';

export const saldoAdjustmentSchema = z.object({
  tipo: z.enum(['debito', 'credito']),
  montoUsd: z.number().positive('monto debe ser positivo'),
  nota: z.string().optional(),
  manual: z.boolean().default(true),
});

export type SaldoAdjustmentDto = z.infer<typeof saldoAdjustmentSchema>;
