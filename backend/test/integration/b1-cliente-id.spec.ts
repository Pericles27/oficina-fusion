import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp } from './test-app';

// Ejecutar sólo con scripts/verify-b1.py: copia allowlist, sin test/setup.ts.
const databaseUrl = 'postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_b1';
if (process.env.DATABASE_URL !== databaseUrl || process.env.B1_SAFE_SNAPSHOT !== '1') {
  throw new Error('B1 requiere snapshot seguro y DB exclusiva redisenio_b1');
}
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

describe('B1 — POST real Nest /operations → SELECT PostgreSQL', () => {
  let app: INestApplication;
  let token: string;
  const suffix = randomUUID();
  const userId = `b1-user-${suffix}`;
  const clienteId = `b1-cliente-${suffix}`;
  const parId = `B1-${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    await prisma.usuario.create({ data: {
      id: userId, username: userId, nombre: 'Operador sintético B1',
      passwordHash: 'synthetic-not-a-login', roles: ['ADMIN'], activo: true,
    } });
    await prisma.par.create({ data: {
      par: parId, base: 'USD', quote: 'ARS', nombre: 'Par sintético B1',
      compra: '1000', venta: '1010', varPct: '0', decimals: 2,
    } });
    await prisma.cliente.create({ data: {
      id: clienteId, nombre: 'Cliente sintético B1', tipo: 'Persona',
    } });
    token = app.get(JwtService).sign({ id: userId, username: userId, roles: ['ADMIN'] });
  });

  afterAll(async () => {
    // Sólo fixtures propios; sin TRUNCATE ni desactivar triggers.
    await prisma.operacion.deleteMany({ where: { operadorId: userId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await prisma.par.deleteMany({ where: { par: parId } });
    await prisma.usuario.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('preserva clienteId en HTTP 201 y SELECT con JOIN, no NULL', async () => {
    const res = await request(app.getHttpServer()).post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId, monto: '100', cotiz: '1000', cobertura: 'efectivo', clienteId })
      .expect(201);
    expect(res.body.clienteId).toBe(clienteId);
    const rows = await prisma.$queryRaw<Array<{ clienteId: string; nombre: string }>>`
      SELECT o."clienteId", c.nombre FROM operacion o
      JOIN cliente c ON c.id = o."clienteId" WHERE o.id = ${res.body.id}`;
    expect(rows).toEqual([{ clienteId, nombre: 'Cliente sintético B1' }]);
  });

  it('permite operación anónima por HTTP y persiste NULL (contrato existente)', async () => {
    const res = await request(app.getHttpServer()).post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'V', parId, monto: '50', cobertura: 'efectivo' }).expect(201);
    const rows = await prisma.$queryRaw<Array<{ clienteId: string | null }>>`
      SELECT "clienteId" FROM operacion WHERE id = ${res.body.id}`;
    expect(rows).toEqual([{ clienteId: null }]);
  });

  it('rechaza monto inválido por HTTP y no inserta operación', async () => {
    const before = await prisma.operacion.count({ where: { operadorId: userId } });
    const res = await request(app.getHttpServer()).post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId, monto: '0', cobertura: 'efectivo', clienteId })
      .expect(400);
    expect(res.body).toHaveProperty('message');
    expect(await prisma.operacion.count({ where: { operadorId: userId } })).toBe(before);
  });
});
