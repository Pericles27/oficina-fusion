/**
 * C2a R1 — Zod DTO tests (solo parsing, sin DB ni service).
 *
 * Ejecución: runner saneado verify-c2a.py (config setupFiles: [] en snapshot).
 * No necesita .env, .npmrc, ni seed. Usa Vitest instalado en node_modules.
 */
import { describe, expect, it } from 'vitest';
import {
  CreateEticketSchema,
  UpdateEticketSchema,
  TramoInputSchema,
  DepOverrideSchema,
} from '../../src/modules/e-tickets/dto/eticket.dto';

// ============================ CreateEticketSchema ============================

describe('CreateEticketSchema', () => {
  it('acepta create válido mixto con cabecera completa', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      operationId: 'OP-0001',
      metodoEntrega: 'mixto',
      direccionEntrega: 'Av. Corrientes 1234',
      telefonoContacto: '11-1234-5678',
      nombreRecibe: 'Juan Pérez',
      horarioEntrega: '10:00-14:00',
      tramos: [
        {
          orden: 1,
          sentido: 'ENTREGA',
          canal: 'EFECTIVO',
          moneda: 'ARS',
          monto: '50000',
        },
        {
          orden: 2,
          sentido: 'RETIRO',
          canal: 'DEPOSITO',
          moneda: 'ARS',
          monto: '50000',
          cuentaDestinoId: 'ACC-001',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza tramos vacío [0]', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'tramos')).toBe(true);
    }
  });

  it('rechaza tramo sin campo obligatorio sentido', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, canal: 'EFECTIVO', moneda: 'ARS', monto: '100' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza tramo sin canal', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, sentido: 'ENTREGA', moneda: 'ARS', monto: '100' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza tramo sin moneda', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', monto: '100' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza monto como number en vez de string', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'ARS', monto: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza monto "0"', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'ARS', monto: '0' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza monto negativo como string', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{ orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'ARS', monto: '-100' }],
    });
    expect(result.success).toBe(false);
  });

  it('acepta tramo con id cuid real (no UUID)', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{
        id: 'ck9abc123def456gh789', // cuid-like, no UUID
        orden: 1,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '50000',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('acepta tramo sin id (nuevo tramo)', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{
        orden: 1,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '50000',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza key extra en DepOverride (campo no whitelist)', () => {
    const result = TramoInputSchema.safeParse({
      orden: 1,
      sentido: 'ENTREGA',
      canal: 'EFECTIVO',
      moneda: 'ARS',
      monto: '100',
      depBeneficiario: 'Test',
      depCampoExtra: 'no permitido',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza key extra en tramo por strict explícito del schema real', () => {
    const result = CreateEticketSchema.safeParse({
      clienteId: 'CL-001',
      tramos: [{
        orden: 1,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '100',
        campoNoExistente: 'x',
      }],
    });

    expect(result.success).toBe(false);
  });
});

// ============================ UpdateEticketSchema ============================

describe('UpdateEticketSchema', () => {
  it('acepta PUT sin tramos (sin cambios)', () => {
    const result = UpdateEticketSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('acepta PUT con lista de tramos completa', () => {
    const result = UpdateEticketSchema.safeParse({
      tramos: [
        {
          id: 'ck9abc123',
          orden: 1,
          sentido: 'ENTREGA',
          canal: 'EFECTIVO',
          moneda: 'ARS',
          monto: '50000',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza tramo con orden no entero', () => {
    const result = UpdateEticketSchema.safeParse({
      tramos: [{
        orden: 1.5,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '100',
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza orden 0', () => {
    const result = UpdateEticketSchema.safeParse({
      tramos: [{
        orden: 0,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '100',
      }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza orden negativo', () => {
    const result = UpdateEticketSchema.safeParse({
      tramos: [{
        orden: -1,
        sentido: 'ENTREGA',
        canal: 'EFECTIVO',
        moneda: 'ARS',
        monto: '100',
      }],
    });
    expect(result.success).toBe(false);
  });
});

// ============================ DepOverrideSchema ============================

describe('DepOverrideSchema', () => {
  it('acepta override con 1 clave', () => {
    const result = DepOverrideSchema.safeParse({ depBeneficiario: 'Nuevo nombre' });
    expect(result.success).toBe(true);
  });

  it('acepta override vacío', () => {
    const result = DepOverrideSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rechaza key desconocida', () => {
    const result = DepOverrideSchema.safeParse({ depCampoInexistente: 'x' });
    expect(result.success).toBe(false);
  });

  it('rechaza campos no dep*', () => {
    const result = DepOverrideSchema.safeParse({ tramos: 'no debería estar aquí' });
    expect(result.success).toBe(false);
  });
});

describe('Contrato HTTP C2a — schemas reales, no helpers sustitutos', () => {
  const tramo = { orden: 1, sentido: 'ENTREGA', canal: 'DEPOSITO', moneda: 'ARS', monto: '1', cuentaDestinoId: 'cm123456789012345678901234' };
  const body = (extra: Record<string, unknown> = {}) => ({ clienteId: 'cm223456789012345678901234', tramos: [{ ...tramo, ...extra }] });

  it('conecta depOverrides al create y conserva la clave enviada', () => {
    const parsed = CreateEticketSchema.parse(body({ depOverrides: { depBeneficiario: 'Sintético' } }));
    expect(parsed.tramos[0].depOverrides).toEqual({ depBeneficiario: 'Sintético' });
    expect(UpdateEticketSchema.parse({ instrucciones: 'cabecera' })).not.toHaveProperty('tramos');
  });

  it('rechaza create sin tramos y update con lista vacía', () => {
    expect(CreateEticketSchema.safeParse({ clienteId: 'sintetico' }).success).toBe(false);
    expect(UpdateEticketSchema.safeParse({ tramos: [] }).success).toBe(false);
  });

  it.each(['depBeneficiario', 'depCuit', 'depBanco', 'depNumeroCuenta', 'depCbu', 'depAlias', 'depTipoCuenta'])('rechaza %s directo aun sin otra key extra', (key) => {
    expect(CreateEticketSchema.safeParse(body({ [key]: 'prohibido' })).success).toBe(false);
    expect(UpdateEticketSchema.safeParse({ tramos: [{ ...tramo, [key]: 'prohibido' }] }).success).toBe(false);
  });

  it.each(['123456789012345678901', '12345678901234567890123', 'abcdefghijklmnopqrstuv', '123456789012345678901a', ''])('rechaza CBU anidado inválido %j', (depCbu) => {
    expect(CreateEticketSchema.safeParse(body({ depOverrides: { depCbu } })).success).toBe(false);
    expect(UpdateEticketSchema.safeParse({ tramos: [{ ...tramo, depOverrides: { depCbu } }] }).success).toBe(false);
  });

  it('acepta CBU22 y null; rechaza override extra en el schema conectado', () => {
    for (const depCbu of ['1234567890123456789012', null]) {
      expect(CreateEticketSchema.parse(body({ depOverrides: { depCbu } })).tramos[0].depOverrides?.depCbu).toBe(depCbu);
    }
    expect(CreateEticketSchema.safeParse(body({ depOverrides: { depBeneficiario: 'X', extra: 'no' } })).success).toBe(false);
  });

  it.each(['1', '0.0001', '99999999999999.9999', '12345678901234.1234'])('mantiene decimal18,4 exacto %s sin float', (monto) => {
    expect(CreateEticketSchema.parse(body({ monto })).tramos[0].monto).toBe(monto);
  });

  it.each([1, 0, '0', '0.0000', '-1', '100000000000000', '99999999999999.99999', '1.00001', '01', '01.5', '.1', '1.', '1e2', '+1', ' 1', '1 ', 'NaN', 'Infinity'])('rechaza monto no canónico/fuera de18,4 %j', (monto) => {
    expect(CreateEticketSchema.safeParse(body({ monto })).success).toBe(false);
  });

  it.each(['estado', 'banco', 'cuentaDeposito', 'monedaEntregar', 'montoEntregar', 'monedaRecibir', 'montoRecibir'])('rechaza campo cabecera no autorizado %s', (key) => {
    expect(UpdateEticketSchema.safeParse({ [key]: 'confirmado' }).success).toBe(false);
    expect(CreateEticketSchema.safeParse({ ...body(), [key]: 'no' }).success).toBe(false);
  });

  it('acepta cuid completo en update, cuenta ausente y cuenta null, no exige UUID', () => {
    for (const cuenta of [{}, { cuentaDestinoId: null }]) {
      const parsed = UpdateEticketSchema.parse({ tramos: [{ orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'USD', monto: '1', id: 'cm323456789012345678901234', ...cuenta }] });
      expect(parsed.tramos?.[0].id).toBe('cm323456789012345678901234');
    }
    expect(UpdateEticketSchema.safeParse({ tramos: [{ ...tramo, id: '' }] }).success).toBe(false);
  });
});
