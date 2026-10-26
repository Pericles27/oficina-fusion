import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolUsuario } from '@prisma/client';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar, createTestCliente, testPrisma } from '../utils/db';

/**
 * #11 — Baja de cliente: DELETE /customers/:id es baja lógica (activo=false),
 * sólo ADMIN, y el cliente deja de listarse con ?activo=true. Sus operaciones
 * se conservan.
 */
describe('Customers delete E2E (#11)', () => {
  let app: INestApplication;

  const login = async (username: string, roles: RolUsuario[]) => {
    const u = await createTestUser({ username, password: 'Passw0rd!', roles });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: u.username, password: u.password })
      .expect(200);
    return res.body.access_token as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('ADMIN da de baja: deja de listarse como activo y conserva sus operaciones', async () => {
    const token = await login('baja.admin', [RolUsuario.ADMIN]);
    await createTestPar();
    const cliente = await createTestCliente({ nombre: 'Cliente Baja' });
    await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo', clienteId: cliente.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/customers/${cliente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const activos = await request(app.getHttpServer())
      .get('/customers?activo=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(activos.body.data.map((c: { id: string }) => c.id)).not.toContain(cliente.id);

    const fila = await testPrisma.cliente.findUnique({ where: { id: cliente.id } });
    expect(fila?.activo).toBe(false);
    expect(await testPrisma.operacion.count({ where: { clienteId: cliente.id } })).toBe(1);
  });

  it('OPERADOR no puede dar de baja (403) y el cliente sigue activo', async () => {
    const token = await login('baja.operador', [RolUsuario.OPERADOR]);
    const cliente = await createTestCliente({ nombre: 'Cliente Protegido' });

    await request(app.getHttpServer())
      .delete(`/customers/${cliente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const fila = await testPrisma.cliente.findUnique({ where: { id: cliente.id } });
    expect(fila?.activo).toBe(true);
  });

  it('cliente inexistente: 404', async () => {
    const token = await login('baja.admin2', [RolUsuario.ADMIN]);
    await request(app.getHttpServer())
      .delete('/customers/no-existe')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
