import { z } from 'zod';

/**
 * #19 — Movimiento manual de saldo, siempre en USD y como string decimal (nunca float).
 * credito: el cliente entrega efectivo y suma saldo; debito: retira o se descuenta.
 */
export const saldoAdjustmentSchema = z.object({
  tipo: z.enum(['debito', 'credito']),
  montoUsd: z.coerce
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'monto en USD con hasta 2 decimales (punto como separador)')
    .refine((v) => Number(v) > 0, 'monto debe ser positivo'),
  nota: z.string().trim().max(300).optional().nullable(),
});

export type SaldoAdjustmentDto = z.infer<typeof saldoAdjustmentSchema>;
