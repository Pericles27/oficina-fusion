import { z } from 'zod';
import { Moneda } from '@prisma/client';

/** Decimal no negativo como string canónico (nunca float). */
const decimalNoNegativo = z.coerce
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Debe ser un número decimal no negativo (punto como separador)');

/** #12 — Un renglón de saldo real, cargado por su valor en USD. */
export const SaldoRealSchema = z.object({
  moneda: z.nativeEnum(Moneda),
  montoUsd: decimalNoNegativo,
  detalle: z.string().trim().max(200).optional().nullable(),
});

export const CreateCierreSchema = z
  .object({
    fecha: z.coerce.date(),
    tcCierre: z.coerce.string(),
    saldoInicialUsd: z.coerce.string(),
    /** Total contado. Con `saldosReales` se calcula como su suma y, si viene, debe coincidir. */
    cajaContadaUsd: z.coerce.string().optional(),
    saldosReales: z.array(SaldoRealSchema).min(1).max(100).optional(),
    notas: z.string().optional().nullable(),
  })
  .refine((d) => d.saldosReales !== undefined || d.cajaContadaUsd !== undefined, {
    message: 'Cargá los saldos reales (o el total contado)',
    path: ['saldosReales'],
  });

export type SaldoRealDto = z.infer<typeof SaldoRealSchema>;
export type CreateCierreDto = z.infer<typeof CreateCierreSchema>;
