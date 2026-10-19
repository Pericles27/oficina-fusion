import { z } from 'zod';

export const MonedaSchema = z.enum(['ARS', 'EUR', 'GBP', 'BRL', 'USD', 'USDT']);
export const EticketEstadoSchema = z.enum(['pendiente', 'en_curso', 'confirmado', 'cancelado']);
export const TramoCanalSchema = z.enum(['EFECTIVO', 'DEPOSITO']);
export const TramoSentidoSchema = z.enum(['ENTREGA', 'RETIRO']);
export const TipoCuentaSchema = z.enum(['CAJA_AHORRO', 'CUENTA_CORRIENTE']);
export const MetodoEntregaSchema = z.enum(['en_mano', 'deposito_banco', 'mixto']);

export const DepOverrideSchema = z.object({
  depBeneficiario: z.string().nullable().optional(),
  depCuit: z.string().nullable().optional(),
  depBanco: z.string().nullable().optional(),
  depNumeroCuenta: z.string().nullable().optional(),
  depCbu: z.string().regex(/^[0-9]{22}$/, 'CBU debe tener 22 dígitos').nullable().optional(),
  depAlias: z.string().nullable().optional(),
  depTipoCuenta: TipoCuentaSchema.nullable().optional(),
  depMonedaCuenta: z.enum(['ARS', 'USD']).nullable().optional(),
}).strict();
export type DepOverride = z.infer<typeof DepOverrideSchema>;

// Decimal(18,4): 14 integer digits, at most 4 fractional digits. No float conversion.
const MontoSchema = z.string()
  .regex(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/, 'monto debe ser decimal canónico de escala 18,4')
  .refine((value) => /[1-9]/.test(value), 'monto debe ser positivo');

export const TramoInputSchema = z.object({
  id: z.string().min(1).optional(),
  orden: z.number().int().positive().max(2147483647),
  sentido: TramoSentidoSchema,
  canal: TramoCanalSchema,
  moneda: MonedaSchema,
  monto: MontoSchema,
  cuentaDestinoId: z.string().min(1).nullable().optional(),
  depOverrides: DepOverrideSchema.optional(),
}).strict();
export type TramoInput = z.infer<typeof TramoInputSchema>;

const CabeceraSchema = z.object({
  clienteId: z.string().min(1),
  operationId: z.string().min(1).nullable().optional(),
  // Compatibility input only; always derived from resulting tramos by the service.
  metodoEntrega: MetodoEntregaSchema.nullable().optional(),
  direccionEntrega: z.string().nullable().optional(),
  telefonoContacto: z.string().nullable().optional(),
  nombreRecibe: z.string().nullable().optional(),
  horarioEntrega: z.string().nullable().optional(),
  instrucciones: z.string().nullable().optional(),
}).strict();

export const CreateEticketSchema = CabeceraSchema.extend({
  tramos: z.array(TramoInputSchema).min(1),
}).strict();
export const UpdateEticketSchema = CabeceraSchema.partial().extend({
  tramos: z.array(TramoInputSchema).min(1).optional(),
}).strict();
export type CreateEticketDto = z.infer<typeof CreateEticketSchema>;
export type UpdateEticketDto = z.infer<typeof UpdateEticketSchema>;