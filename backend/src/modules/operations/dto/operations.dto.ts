// =============================================================
// Operations DTOs — Validaciones Zod para las operaciones
// =============================================================

import { z } from 'zod';

// Enums
export const OpTipoSchema = z.enum(['C', 'V'] as const);
export const OpStatusSchema = z.enum(['pendiente', 'en_ejecucion', 'finalizada', 'cancelada'] as const);
export const CoberturaSchema = z.enum(['efectivo', 'saldo'] as const);
export const PricingModeSchema = z.enum(['standard', 'precio_amigo', 'personalizado'] as const);

// Create operation
export const CreateOpSchema = z.object({
  tipo: OpTipoSchema,
  parId: z.string().min(1, 'El par es requerido'),
  monto: z.coerce.string().refine(v => {
    const n = Number(v);
    return n > 0;
  }, 'monto debe ser > 0'),
  cotiz: z.coerce.string().optional().refine(v => !v || Number(v) > 0, 'cotiz debe ser > 0'),
  cobertura: CoberturaSchema,
  clienteId: z.string().optional().nullable(),
  marketRateId: z.string().optional().nullable(),
  clientRate: z.coerce.string().optional().nullable(),
  puntos: z.coerce.string().optional().nullable(),
  pricingMode: PricingModeSchema.optional().nullable(),
  notas: z.string().optional().nullable(),
});

export type CreateOpDto = z.infer<typeof CreateOpSchema>;

// Update operation (partial)
export const UpdateOpSchema = z.object({
  tipo: OpTipoSchema.optional(),
  parId: z.string().min(1).optional(),
  monto: z.coerce.string().optional().refine(v => !v || Number(v) > 0, 'monto debe ser > 0'),
  cotiz: z.coerce.string().optional().refine(v => !v || Number(v) > 0, 'cotiz debe ser > 0'),
  cobertura: CoberturaSchema.optional(),
  clienteId: z.string().optional().nullable(),
  clientRate: z.coerce.string().optional().nullable(),
  puntos: z.coerce.string().optional().nullable(),
  pricingMode: PricingModeSchema.optional().nullable(),
  status: OpStatusSchema.optional(),
  notas: z.string().optional().nullable(),
  balanceIn: z.coerce.string().optional().nullable(),
  balanceOut: z.coerce.string().optional().nullable(),
  tsEjecucion: z.coerce.date().optional().nullable(),
  tsFinalizada: z.coerce.date().optional().nullable(),
});

export type UpdateOpDto = z.infer<typeof UpdateOpSchema>;

// Query filters for list/blotter
export const OpFilterSchema = z.object({
  status: OpStatusSchema.optional(),
  tipo: OpTipoSchema.optional(),
  parId: z.string().optional(),
  clienteId: z.string().optional(),
  operadorId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
});

export type OpFilterDto = z.infer<typeof OpFilterSchema>;

// Response shape for a single operation (excludes internal decimals)
export const OpResponseSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  numero: z.number(),
  ts: z.date(),
  tsEjecucion: z.date().nullable(),
  tsFinalizada: z.date().nullable(),
  tipo: OpTipoSchema,
  parId: z.string(),
  par: z.object({
    par: z.string(),
    base: z.string(),
    quote: z.string(),
    nombre: z.string(),
    compra: z.coerce.string(),
    venta: z.coerce.string(),
    varPct: z.coerce.string(),
    decimals: z.number(),
  }),
  monto: z.coerce.string(),
  cotiz: z.coerce.string(),
  contra: z.coerce.string(),
  cobertura: CoberturaSchema,
  status: OpStatusSchema,
  operadorId: z.string(),
  clienteId: z.string().nullable(),
  marketRateId: z.string().nullable(),
  clientRate: z.coerce.string().nullable(),
  puntos: z.coerce.string().nullable(),
  pricingMode: z.string().nullable(),
  balanceIn: z.coerce.string(),
  balanceOut: z.coerce.string(),
  notas: z.string().nullable(),
  cierreId: z.string().nullable(),
  comision: z.any().nullable(),
  cliente: z.any().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OpResponseDto = z.infer<typeof OpResponseSchema>;

// KPI response
export const KpiResponseSchema = z.object({
  fecha: z.string(),
  volumenTotalUsd: z.coerce.string(),
  nOps: z.number(),
  nCompras: z.number(),
  nVentas: z.number(),
  gananciaEstimadaUsd: z.coerce.string(),
  spreadPromedio: z.coerce.string(),
  operaciones: z.array(z.object({
    id: z.string(),
    codigo: z.string(),
    tipo: OpTipoSchema,
    parId: z.string(),
    monto: z.coerce.string(),
    cotiz: z.coerce.string(),
    contra: z.coerce.string(),
    status: OpStatusSchema,
    operadorId: z.string(),
    clienteId: z.string().nullable(),
    ts: z.date(),
  })),
});

export type KpiResponseDto = z.infer<typeof KpiResponseSchema>;
