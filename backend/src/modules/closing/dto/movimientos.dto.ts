import { z } from 'zod';

/** Decimal positivo como string canónico (nunca float). */
const decimalPositivo = z.coerce
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Debe ser un número decimal (punto como separador)')
  .refine((v) => Number(v) > 0, 'Debe ser mayor que 0');

const decimalNoNegativo = z.coerce
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Debe ser un número decimal no negativo (punto como separador)');

/** Día al que se imputa el movimiento (el de la pantalla de cierre). Sin fecha: ahora. */
const fecha = z.coerce.date().optional();

/** #13 — Cable o USDT: ingreso, egreso y comisión (la paga la oficina), siempre en USD. */
export const CreateMovimientoUsdSchema = z.object({
  ingresoUsd: decimalPositivo,
  egresoUsd: decimalPositivo,
  comisionUsd: decimalNoNegativo.default('0'),
  notas: z.string().trim().max(300).optional().nullable(),
  fecha,
});

/** #13 — Gasto en USD. JEFE_A_DEVOLVER queda como deuda del jefe, no como gasto del día. */
export const CreateGastoSchema = z.object({
  concepto: z.string().trim().min(1, 'El concepto es obligatorio').max(200),
  montoUsd: decimalPositivo,
  tipo: z.enum(['OFICINA', 'JEFE', 'JEFE_A_DEVOLVER']).default('OFICINA'),
  categoria: z.enum(['Comida', 'Insumos', 'Transporte', 'Servicios', 'Otros']).default('Otros'),
  notas: z.string().trim().max(300).optional().nullable(),
  fecha,
});

export type CreateMovimientoUsdDto = z.infer<typeof CreateMovimientoUsdSchema>;
export type CreateGastoDto = z.infer<typeof CreateGastoSchema>;
