import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDb,
  createTestUser,
  createTestPar,
  createTestCliente,
} from '../../../test/utils/db';

describe('OperationsService (integración con Postgres de test)', () => {
  let service: OperationsService;

  beforeAll(() => {
    service = new OperationsService(testPrisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestDb();
  });

  it('crea una operación de compra calculando contra = monto * cotiz', async () => {
    const user = await createTestUser({ username: 'operador1' });
    await createTestPar({ par: 'USD/ARS', compra: '1000', venta: '1010' });

    const op = await service.create(
      {
        tipo: 'C',
        parId: 'USD/ARS',
        monto: '100',
        cobertura: 'efectivo',
      } as any,
      user.id,
    );

    expect(op.codigo).toMatch(/^OP-\d{4}$/);
    expect(op.tipo).toBe('C');
    expect(Number(op.monto)).toBe(100);
    expect(Number(op.cotiz)).toBe(1000); // usa precio de compra del par por default
    expect(Number(op.contra)).toBe(100000);
    expect(op.status).toBe('pendiente');
  });

  it('usa el precio de venta del par cuando tipo=V y no se especifica cotiz', async () => {
    const user = await createTestUser({ username: 'operador2' });
    await createTestPar({ par: 'USD/ARS', compra: '1000', venta: '1010' });

    const op = await service.create(
      { tipo: 'V', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo' } as any,
      user.id,
    );

    expect(Number(op.cotiz)).toBe(1010);
    expect(Number(op.contra)).toBe(10100);
  });

  it('rechaza la creación si el par no existe', async () => {
    const user = await createTestUser({ username: 'operador3' });
    await expect(
      service.create({ tipo: 'C', parId: 'NOPE/XXX', monto: '10', cobertura: 'efectivo' } as any, user.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('numera operaciones incrementalmente (códigos OP-0001, OP-0002...)', async () => {
    const user = await createTestUser({ username: 'operador4' });
    await createTestPar({ par: 'USD/ARS' });

    const op1 = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );
    const op2 = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );

    expect(op2.numero).toBe(op1.numero + 1);
  });

  it('lista operaciones paginadas y filtra por status/tipo', async () => {
    const user = await createTestUser({ username: 'operador5' });
    await createTestPar({ par: 'USD/ARS' });

    for (let i = 0; i < 3; i++) {
      await service.create(
        { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
        user.id,
      );
    }
    await service.create(
      { tipo: 'V', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );

    const all = await service.findAll({ page: 1, pageSize: 20 } as any);
    expect(all.total).toBe(4);

    const onlyCompras = await service.findAll({ page: 1, pageSize: 20, tipo: 'C' } as any);
    expect(onlyCompras.total).toBe(3);
    expect(onlyCompras.data.every((o) => o.tipo === 'C')).toBe(true);
  });

  it('lanza NotFoundException al buscar una operación inexistente', async () => {
    await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
  });

  it('actualiza campos permitidos y recalcula contra si cambia monto/cotiz', async () => {
    const user = await createTestUser({ username: 'operador6' });
    await createTestPar({ par: 'USD/ARS', compra: '1000' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo' } as any,
      user.id,
    );

    const updated = await service.update(op.id, { monto: '20' } as any);
    expect(Number(updated.monto)).toBe(20);
    expect(Number(updated.contra)).toBe(20000); // 20 * 1000
  });

  it('rechaza modificar una operación ya asociada a un cierre (inmutable)', async () => {
    const user = await createTestUser({ username: 'operador7' });
    await createTestPar({ par: 'USD/ARS' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );

    const cierre = await testPrisma.cierre.create({
      data: {
        fecha: new Date('2026-01-01'),
        operadorCierreId: user.id,
        operadorCierreNombre: user.username,
        tcCierre: '1000',
        saldoInicialUsd: '0',
        cajaContadaUsd: '0',
        posicionEsperadaUsd: '0',
        diferenciaUsd: '0',
        gananciaRealizadaUsd: '0',
        exposicionAbiertaUsd: '0',
        netoAbiertoUsd: '0',
        totalComisionesUsd: '0',
        totalGastosArs: '0',
        totalGastosUsd: '0',
        resultadoOperativoUsd: '0',
        volumenTotalUsd: '0',
        nOps: 0,
      },
    });
    await testPrisma.operacion.update({ where: { id: op.id }, data: { cierreId: cierre.id } });

    await expect(service.update(op.id, { notas: 'intento' } as any)).rejects.toThrow(BadRequestException);
  });

  it('finaliza una operación pendiente y setea tsFinalizada', async () => {
    const user = await createTestUser({ username: 'operador8' });
    await createTestPar({ par: 'USD/ARS' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );

    const finalized = await service.finalize(op.id);
    expect(finalized.status).toBe('finalizada');
    expect(finalized.tsFinalizada).not.toBeNull();
  });

  it('rechaza finalizar una operación ya finalizada', async () => {
    const user = await createTestUser({ username: 'operador9' });
    await createTestPar({ par: 'USD/ARS' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );
    await service.finalize(op.id);

    await expect(service.finalize(op.id)).rejects.toThrow(BadRequestException);
  });

  it('cancela una operación pendiente', async () => {
    const user = await createTestUser({ username: 'operador10' });
    await createTestPar({ par: 'USD/ARS' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );

    const cancelled = await service.cancel(op.id);
    expect(cancelled.status).toBe('cancelada');
  });

  it('rechaza cancelar una operación ya finalizada', async () => {
    const user = await createTestUser({ username: 'operador11' });
    await createTestPar({ par: 'USD/ARS' });
    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo' } as any,
      user.id,
    );
    await service.finalize(op.id);

    await expect(service.cancel(op.id)).rejects.toThrow(BadRequestException);
  });

  it('kpisByPar agrega correctamente el volumen de operaciones no canceladas', async () => {
    const user = await createTestUser({ username: 'operador12' });
    await createTestPar({ par: 'USD/ARS', compra: '1000', venta: '1010' });

    await service.create({ tipo: 'C', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo' } as any, user.id);
    const cancelled = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '999', cobertura: 'efectivo' } as any,
      user.id,
    );
    await service.cancel(cancelled.id);

    const kpi = await service.kpisByPar();
    expect(kpi.stats).toHaveLength(1);
    expect(kpi.stats[0].nOps).toBe(1); // la cancelada no cuenta
  });

  it('kpisByOperador agrega correctamente por operador', async () => {
    const user = await createTestUser({ username: 'operador13' });
    await createTestPar({ par: 'USD/ARS' });
    await service.create({ tipo: 'C', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo' } as any, user.id);
    await service.create({ tipo: 'V', parId: 'USD/ARS', monto: '5', cobertura: 'efectivo' } as any, user.id);

    const kpi = await service.kpisByOperador();
    expect(kpi.stats).toHaveLength(1);
    expect(kpi.stats[0].nOps).toBe(2);
    expect(kpi.nOpsTotal).toBe(2);
  });

  it('asocia clienteId cuando se provee en la creación', async () => {
    const user = await createTestUser({ username: 'operador14' });
    await createTestPar({ par: 'USD/ARS' });
    const cliente = await createTestCliente({ nombre: 'Acme SA' });

    const op = await service.create(
      { tipo: 'C', parId: 'USD/ARS', monto: '1', cobertura: 'efectivo', clienteId: cliente.id } as any,
      user.id,
    );

    expect(op.clienteId).toBe(cliente.id);
  });
});
