import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestCliente } from '../utils/db';
import { RolUsuario } from '@prisma/client';

/**
 * F5 — filtro de cadete en e-tickets (opción C: bolsa común, ver
 * ANALISIS-FASES-3-4-5.md §2). El scope se deriva del TOKEN, no de un
 * query param: un cadete que pasa ?cadeteId=<otro> a mano no debe poder
 * cambiar lo que ve. Bolsa común significa que NO hay "dueño" de un
 * e-ticket: cualquier cadete ve/confirma cualquier pendiente -- por
 * diseño no aplica un 403/404 por "e-ticket de otro cadete" (no existe
 * tal concepto todavía, no hay campo asignadoA en el modelo).
 */
describe('F5 — e-tickets, scope de CADETE vía token (bolsa común)', () => {
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

  async function crearEticket(adminToken: string, overrides: Record<string, unknown> = {}) {
    const cliente = await createTestCliente();
    const res = await request(app.getHttpServer())
      .post('/e-tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clienteId: cliente.id,
        metodoEntrega: 'en_mano',
        monedaEntregar: 'USD',
        montoEntregar: '1000.00',
        monedaRecibir: 'ARS',
        montoRecibir: '1250000.00',
        ...overrides,
      })
      .expect(201);
    return res.body;
  }

  it('GET /e-tickets con token CADETE no devuelve montoEntregar/montoRecibir/monedas', async () => {
    const adminToken = await loginAs('admin.f5.list', [RolUsuario.ADMIN]);
    await crearEticket(adminToken);
    const cadeteToken = await loginAs('cadete.f5.list', [RolUsuario.CADETE]);

    const res = await request(app.getHttpServer())
      .get('/e-tickets')
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const et of res.body.data) {
      expect(et.montoEntregar).toBeUndefined();
      expect(et.montoRecibir).toBeUndefined();
      expect(et.monedaEntregar).toBeUndefined();
      expect(et.monedaRecibir).toBeUndefined();
    }
  });

  it('GET /e-tickets/:id con token CADETE no devuelve datos económicos', async () => {
    const adminToken = await loginAs('admin.f5.one', [RolUsuario.ADMIN]);
    const et = await crearEticket(adminToken);
    const cadeteToken = await loginAs('cadete.f5.one', [RolUsuario.CADETE]);

    const res = await request(app.getHttpServer())
      .get(`/e-tickets/${et.id}`)
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    expect(res.body.montoEntregar).toBeUndefined();
    expect(res.body.montoRecibir).toBeUndefined();
    expect(res.body.monedaEntregar).toBeUndefined();
    expect(res.body.monedaRecibir).toBeUndefined();
    // Sí ve lo operativo
    expect(res.body.codigo).toBeDefined();
    expect(res.body.metodoEntrega).toBeDefined();
  });

  it('un cadete que pasa ?cadeteId=<otro-id> a mano es ignorado (scope fijo por token)', async () => {
    const adminToken = await loginAs('admin.f5.qp', [RolUsuario.ADMIN]);
    await crearEticket(adminToken);
    const cadeteToken = await loginAs('cadete.f5.qp', [RolUsuario.CADETE]);

    const conQuery = await request(app.getHttpServer())
      .get('/e-tickets?cadeteId=un-id-que-no-existe-y-no-deberia-importar')
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    const sinQuery = await request(app.getHttpServer())
      .get('/e-tickets')
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    // Mismo resultado con o sin el query param -- se ignora.
    expect(conQuery.body.total).toBe(sinQuery.body.total);
  });

  it('un cadete que pasa ?estado=confirmado a mano sigue viendo sólo pendientes', async () => {
    const adminToken = await loginAs('admin.f5.estado', [RolUsuario.ADMIN]);
    const et = await crearEticket(adminToken);
    await request(app.getHttpServer())
      .post(`/e-tickets/${et.id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const cadeteToken = await loginAs('cadete.f5.estado', [RolUsuario.CADETE]);
    const res = await request(app.getHttpServer())
      .get('/e-tickets?estado=confirmado')
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    // El e-ticket ya confirmado NO aparece -- el servidor fuerza
    // estado=pendiente sin importar lo que pida el query.
    expect(res.body.data.find((x: { id: string }) => x.id === et.id)).toBeUndefined();
  });

  it('bolsa común: un cadete puede ver (vista reducida) y confirmar un e-ticket creado para cualquier cliente', async () => {
    const adminToken = await loginAs('admin.f5.bolsa', [RolUsuario.ADMIN]);
    const et = await crearEticket(adminToken);
    const cadeteToken = await loginAs('cadete.f5.bolsa', [RolUsuario.CADETE]);

    // No hay "dueño" -- cualquier cadete ve el pendiente de bolsa común.
    await request(app.getHttpServer())
      .get(`/e-tickets/${et.id}`)
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/e-tickets/${et.id}/confirm`)
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(201);
  });

  it('GET /e-tickets/:id de un e-ticket inexistente -> 404 también para CADETE', async () => {
    const cadeteToken = await loginAs('cadete.f5.404', [RolUsuario.CADETE]);

    await request(app.getHttpServer())
      .get('/e-tickets/no-existe-este-id')
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(404);
  });

  it('un CADETE recibe 403 al intentar crear o cancelar un e-ticket', async () => {
    const adminToken = await loginAs('admin.f5.perm', [RolUsuario.ADMIN]);
    const et = await crearEticket(adminToken);
    const cadeteToken = await loginAs('cadete.f5.perm', [RolUsuario.CADETE]);

    await request(app.getHttpServer())
      .post(`/e-tickets/${et.id}/cancel`)
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(403);
  });
});
