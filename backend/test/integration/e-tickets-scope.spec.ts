import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestCliente, testPrisma } from '../utils/db';
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
        direccionEntrega: 'Calle sintética 123',
        tramos: [
          { orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'USD', monto: '1000.00' },
          { orden: 2, sentido: 'RETIRO', canal: 'EFECTIVO', moneda: 'ARS', monto: '1250000.00' },
        ],
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

  it('U5: el cadete ve montos y cuenta de depósito de un mixto, y nada económico en el JSON', async () => {
    const adminToken = await loginAs('admin.f5.mixto', [RolUsuario.ADMIN]);
    const cliente = await createTestCliente();
    const cuenta = await testPrisma.cuentaCliente.create({ data: {
      clienteId: cliente.id, banco: 'Banco sintético', numero: 'syn-001', titular: 'Titular sintético',
      cuitTitular: '20123456789', tipoCuenta: 'CAJA_AHORRO', monedaCuenta: 'ARS', numeroCuenta: '000111',
      cbu: '1234567890123456789012', alias: 'sintetico.alias',
    } });
    const created = await request(app.getHttpServer())
      .post('/e-tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clienteId: cliente.id,
        direccionEntrega: 'Calle sintética 123',
        tramos: [
          { orden: 1, sentido: 'RETIRO', canal: 'EFECTIVO', moneda: 'USD', monto: '1000' },
          { orden: 2, sentido: 'ENTREGA', canal: 'DEPOSITO', moneda: 'ARS', monto: '1250000.5', cuentaDestinoId: cuenta.id },
        ],
      })
      .expect(201);
    expect(created.body.metodoEntrega).toBe('mixto');
    const cadeteToken = await loginAs('cadete.f5.mixto', [RolUsuario.CADETE]);

    const res = await request(app.getHttpServer())
      .get(`/e-tickets/${created.body.id}`)
      .set('Authorization', `Bearer ${cadeteToken}`)
      .expect(200);

    expect(res.body.tramos.map((t: { sentido: string; moneda: string; monto: string }) => [t.sentido, t.moneda, t.monto]))
      .toEqual([['RETIRO', 'USD', '1000'], ['ENTREGA', 'ARS', '1250000.5']]);
    expect(res.body.tramos[1].depNumeroCuenta).toBe('000111');
    expect(res.body.tramos[1].depTipoCuenta).toBe('CAJA_AHORRO');
    expect(res.body.tramos[1].depMonedaCuenta).toBe('ARS');
    expect(JSON.stringify(res.body)).not.toMatch(
      /cotiz|clientRate|marketRate|puntos|comision|spread|ganancia|operadorDueno|saldo|montoEntregar|montoRecibir|"operation"/i,
    );
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

  it('C4: ADMIN filtra por operationId; un CADETE no puede usar el filtro para salir de su alcance', async () => {
    const adminToken = await loginAs('admin.c4.op', [RolUsuario.ADMIN]);
    const par = await testPrisma.par.create({ data: { par: 'USD/ARS', base: 'USD', quote: 'ARS', nombre: 'Dólar / Peso', compra: '1000', venta: '1010', varPct: '0', decimals: 2 } });
    const op = await request(app.getHttpServer()).post('/operations').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipo: 'C', parId: par.par, monto: '10', cobertura: 'efectivo' }).expect(201);
    // U7: los tramos suman lo mismo que la operación (compra 10 USD a 1000: se retiran 10 USD y se dejan 10.000 ARS).
    const conOp = await crearEticket(adminToken, {
      operationId: op.body.id,
      tramos: [
        { orden: 1, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'ARS', monto: '10000' },
        { orden: 2, sentido: 'RETIRO', canal: 'EFECTIVO', moneda: 'USD', monto: '10' },
      ],
    });
    await crearEticket(adminToken);

    const res = await request(app.getHttpServer())
      .get(`/e-tickets?operationId=${op.body.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.data.map((e: { id: string }) => e.id)).toEqual([conOp.id]);

    const cadeteToken = await loginAs('cadete.c4.op', [RolUsuario.CADETE]);
    const cadete = await request(app.getHttpServer())
      .get(`/e-tickets?operationId=${op.body.id}`).set('Authorization', `Bearer ${cadeteToken}`).expect(200);
    expect(cadete.body.total).toBe(2);
  });
});
