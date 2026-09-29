import { z } from 'zod';

export const MonedaSchema = z.enum(['ARS', 'EUR', 'GBP', 'BRL', 'USD', 'USDT'] as const);
export const EticketEstadoSchema = z.enum(['pendiente', 'en_curso', 'confirmado', 'cancelado'] as const);

export const CreateEticketSchema = z.object({
  clienteId: z.string().min(1, 'clienteId es requerido'),
  operationId: z.string().optional().nullable(),
  metodoEntrega: z.string().min(1, 'metodoEntrega es requerido'),
  direccionEntrega: z.string().optional().nullable(),
  telefonoContacto: z.string().optional().nullable(),
  nombreRecibe: z.string().optional().nullable(),
  horarioEntrega: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  cuentaDeposito: z.string().optional().nullable(),
  instrucciones: z.string().optional().nullable(),
  monedaEntregar: MonedaSchema.optional().nullable(),
  montoEntregar: z.coerce.string().optional().nullable(),
  monedaRecibir: MonedaSchema.optional().nullable(),
  montoRecibir: z.coerce.string().optional().nullable(),
});

export type CreateEticketDto = z.infer<typeof CreateEticketSchema>;

export const UpdateEticketSchema = z.object({
  estado: EticketEstadoSchema.optional(),
  direccionEntrega: z.string().optional().nullable(),
  telefonoContacto: z.string().optional().nullable(),
  nombreRecibe: z.string().optional().nullable(),
  horarioEntrega: z.string().optional().nullable(),
  instrucciones: z.string().optional().nullable(),
});

export type UpdateEticketDto = z.infer<typeof UpdateEticketSchema>;
