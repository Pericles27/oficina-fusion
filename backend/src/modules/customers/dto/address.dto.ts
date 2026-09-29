import { z } from 'zod';

export const createAddressSchema = z.object({
  direccion: z.string().min(1, 'dirección es requerida'),
  tipo: z.string().optional(),
  ciudad: z.string().optional(),
  provincia: z.string().optional(),
  codigoPost: z.string().optional(),
  principal: z.boolean().optional(),
});

export type CreateAddressDto = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = z.object({
  direccion: z.string().min(1).optional(),
  tipo: z.string().optional(),
  ciudad: z.string().optional(),
  provincia: z.string().optional(),
  codigoPost: z.string().optional(),
  principal: z.boolean().optional(),
});

export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
