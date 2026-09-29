import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar } from '../utils/db';

/**
 * Test de integración: crea una operación real vía HTTP (autenticado) y
 * verifica el listado/filtrado, contra la DB de test.
 */
describe('Operations E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
    const admin = await createTestUser({ username: 'op.admin', password: 'Passw0rd!' });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: admin.username, password: admin.password })
      .expect(200);
    token = loginRes.body.access_token;
  });

  it('rechaza crear una operación sin autenticación (401)', async () => {
    await createTestPar();

    await request(app.getHttpServer())
      .post('/operations')
      .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
      .expect(401);
  });

  it('crea una operación de compra y calcula contra = monto * cotiz', async () => {
    await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
      .expect(201);

    expect(res.body.codigo).toBe('OP-0001');
    expect(res.body.tipo).toBe('C');
    expect(Number(res.body.monto)).toBe(100);
    expect(Number(res.body.cotiz)).toBe(1000);
    expect(Number(res.body.contra)).toBe(100000);
    expect(res.body.status).toBe('pendiente');
  });

  it('rechaza crear una operación con un par inexistente (400)', async () => {
    await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId: 'NOPE/XYZ', monto: '100', cobertura: 'efectivo' })
      .expect(400);
  });

  it('lista operaciones creadas y respeta filtros por tipo/status', async () => {
    await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });

    await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'V', parId: 'USD/ARS', monto: '50', cobertura: 'efectivo' })
      .expect(201);

    const allRes = await request(app.getHttpServer())
      .get('/operations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(allRes.body.total).toBe(2);
    expect(allRes.body.data).toHaveLength(2);

    const filteredRes = await request(app.getHttpServer())
      .get('/operations')
      .query({ tipo: 'V' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filteredRes.body.total).toBe(1);
    expect(filteredRes.body.data[0].tipo).toBe('V');
  });

  it('permite consultar, finalizar y luego cancelar es rechazado (flujo de estado)', async () => {
    await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'C', parId: 'USD/ARS', monto: '10', cobertura: 'efectivo' })
      .expect(201);

    const opId = createRes.body.id;

    const getRes = await request(app.getHttpServer())
      .get(`/operations/${opId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.id).toBe(opId);

    const finalizeRes = await request(app.getHttpServer())
      .post(`/operations/${opId}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(finalizeRes.body.status).toBe('finalizada');

    // Ya finalizada: cancelar debe fallar (400)
    await request(app.getHttpServer())
      .post(`/operations/${opId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
