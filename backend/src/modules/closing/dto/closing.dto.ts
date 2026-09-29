import { z } from 'zod';

export const CreateCierreSchema = z.object({
  fecha: z.coerce.date(),
  tcCierre: z.coerce.string(),
  saldoInicialUsd: z.coerce.string(),
  cajaContadaUsd: z.coerce.string(),
  notas: z.string().optional().nullable(),
});

export type CreateCierreDto = z.infer<typeof CreateCierreSchema>;
