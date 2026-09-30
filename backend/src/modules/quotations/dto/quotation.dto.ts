// =============================================================
// Quotations DTOs — F6, alcance mínimo: sólo compra/venta del par.
// =============================================================

import { z } from 'zod';

export const UpdateQuotationSchema = z.object({
  compra: z.coerce.string().refine((v) => Number(v) > 0, 'compra debe ser > 0'),
  venta: z.coerce.string().refine((v) => Number(v) > 0, 'venta debe ser > 0'),
});

export type UpdateQuotationDto = z.infer<typeof UpdateQuotationSchema>;
