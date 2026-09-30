import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar } from '../utils/db';
import { RolUsuario } from '@prisma/client';

/**
 * F6 — Cotizaciones, alcance mínimo (PLAN-PRODUCCION.md §FASE 6):
 * GET /quotations (pares con compra/venta) y PUT /quotations/:par
 * (@Roles(ADMIN, OPERADOR)). Nada de histórico ni feeds externos.
 */
describe('F6 — quotations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  async function loginAs(username: string, roles: RolUsuario[]): Promise<string> {
    const user = await createTestUser({ username, roles });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: user.username, password: user.password })
      .expect(200);
    return res.body.access_token as string;
  }

  describe('GET /quotations', () => {
    it('devuelve los pares con compra/venta', async () => {
      await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });
      await createTestPar({ par: 'EUR/ARS', base: 'EUR', compra: '1100.00', venta: '1110.00' });
      const token = await loginAs('operador.q.get', [RolUsuario.OPERADOR]);

      const res = await request(app.getHttpServer())
        .get('/quotations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      const usd = res.body.find((p: { par: string }) => p.par === 'USD/ARS');
      expect(Number(usd.compra)).toBe(1000);
      expect(Number(usd.venta)).toBe(1010);
    });

    it('un CADETE también puede leer (no es dato económico sensible)', async () => {
      await createTestPar();
      const token = await loginAs('cadete.q.get', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .get('/quotations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/quotations').expect(401);
    });
  });

  describe('PUT /quotations/:par', () => {
    it('un ADMIN puede actualizar una cotización y persiste', async () => {
      await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });
      const token = await loginAs('admin.q.put', [RolUsuario.ADMIN]);

      const res = await request(app.getHttpServer())
        .put('/quotations/USD/ARS')
        .set('Authorization', `Bearer ${token}`)
        .send({ compra: '1234567.89', venta: '1234999.99' })
        .expect(200);

      expect(res.body.compra).toBe('1234567.89');
      expect(res.body.venta).toBe('1234999.99');

      const getRes = await request(app.getHttpServer())
        .get('/quotations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const usd = getRes.body.find((p: { par: string }) => p.par === 'USD/ARS');
      expect(usd.compra).toBe('1234567.89');
    });

    it('un OPERADOR puede actualizar una cotización (201/200)', async () => {
      await createTestPar();
      const token = await loginAs('operador.q.put', [RolUsuario.OPERADOR]);

      await request(app.getHttpServer())
        .put('/quotations/USD/ARS')
        .set('Authorization', `Bearer ${token}`)
        .send({ compra: '1005.00', venta: '1015.00' })
        .expect(200);
    });

    it('un CADETE recibe 403', async () => {
      await createTestPar();
      const token = await loginAs('cadete.q.put', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .put('/quotations/USD/ARS')
        .set('Authorization', `Bearer ${token}`)
        .send({ compra: '1005.00', venta: '1015.00' })
        .expect(403);
    });

    it('par inexistente → 404', async () => {
      const token = await loginAs('admin.q.404', [RolUsuario.ADMIN]);

      await request(app.getHttpServer())
        .put('/quotations/NOPE/XXX')
        .set('Authorization', `Bearer ${token}`)
        .send({ compra: '1', venta: '2' })
        .expect(404);
    });

    it('body inválido (compra <= 0) → 400', async () => {
      await createTestPar();
      const token = await loginAs('admin.q.400', [RolUsuario.ADMIN]);

      await request(app.getHttpServer())
        .put('/quotations/USD/ARS')
        .set('Authorization', `Bearer ${token}`)
        .send({ compra: '0', venta: '1015.00' })
        .expect(400);
    });
  });
});
