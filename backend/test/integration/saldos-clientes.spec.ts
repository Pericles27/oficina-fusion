import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar, createTestCliente, testPrisma } from '../utils/db';

/**
 * #19 — Saldo de clientes en USD (operaciones contra saldo, movimientos manuales,
 * cierre y reporte) y U7 — los tramos del e-ticket suman exactamente la operación.
 */
describe('Saldos de clientes (#19) y conciliación de tramos (U7)', () => {
  let app: INestApplication;
  let token: string;

  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fecha = `${ymd}T12:00:00`;

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  async function crearOp(body: { tipo: 'C' | 'V'; monto: string; cotiz: string; cobertura?: 'efectivo' | 'saldo'; clienteId?: string }) {
    const res = await auth(http().post('/operations'))
      .send({ parId: 'USD/ARS', cobertura: 'efectivo', ...body })
      .expect(201);
    return res.body.id as string;
  }
  const finalizar = (id: string) => auth(http().post(`/operations/${id}/finalize`)).expect(201);
  const saldoDe = async (clienteId: string) =>
    (await testPrisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })).saldoUsd.toFixed(2);
  const efectivo = (orden: number, sentido: 'ENTREGA' | 'RETIRO', moneda: string, monto: string) =>
    ({ orden, sentido, canal: 'EFECTIVO', moneda, monto });

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await testPrisma.$transaction([
      testPrisma.$executeRawUnsafe('SET session_replication_role = replica'),
      testPrisma.cierreSaldoReal.deleteMany(),
      testPrisma.$executeRawUnsafe('SET session_replication_role = origin'),
    ]);
    await cleanDatabase();
    await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });
    const admin = await createTestUser({ username: 'saldos.admin', password: 'Passw0rd!' });
    const loginRes = await http()
      .post('/auth/login')
      .send({ username: admin.username, password: admin.password })
      .expect(200);
    token = loginRes.body.access_token;
  });

  describe('U7 — tramos contra la operación', () => {
    it('rechaza tramos que no suman la operación y acepta los que suman exacto, aunque estén partidos', async () => {
      const cliente = await createTestCliente();
      // Compra 10 USD a 1000: la oficina retira 10 USD y deja 10.000 ARS.
      const opId = await crearOp({ tipo: 'C', monto: '10', cotiz: '1000', clienteId: cliente.id });
      const base = { clienteId: cliente.id, operationId: opId, direccionEntrega: 'Calle sintética 123' };

      const corto = await auth(http().post('/e-tickets'))
        .send({ ...base, tramos: [efectivo(1, 'ENTREGA', 'ARS', '9000'), efectivo(2, 'RETIRO', 'USD', '10')] })
        .expect(400);
      expect(corto.body.message).toContain('suman 9000');

      const ajeno = await auth(http().post('/e-tickets'))
        .send({ ...base, tramos: [efectivo(1, 'ENTREGA', 'ARS', '10000'), efectivo(2, 'RETIRO', 'USD', '10'), efectivo(3, 'ENTREGA', 'EUR', '1')] })
        .expect(400);
      expect(ajeno.body.message).toContain('no corresponde');
      expect(await testPrisma.eticket.count()).toBe(0);

      const ok = await auth(http().post('/e-tickets'))
        .send({ ...base, tramos: [efectivo(1, 'ENTREGA', 'ARS', '6000'), efectivo(2, 'ENTREGA', 'ARS', '4000.00'), efectivo(3, 'RETIRO', 'USD', '10')] })
        .expect(201);

      // Editar los tramos también se controla, y sin escribir nada si no suma.
      await auth(http().put(`/e-tickets/${ok.body.id}`))
        .send({ tramos: [efectivo(1, 'ENTREGA', 'ARS', '6000'), efectivo(2, 'RETIRO', 'USD', '10')] })
        .expect(400);
      expect(await testPrisma.eticketTramo.count({ where: { eticketId: ok.body.id } })).toBe(3);

      // Con el e-ticket activo, la operación no cambia de monto.
      await auth(http().put(`/operations/${opId}`)).send({ monto: '20' }).expect(400);
      await auth(http().post(`/e-tickets/${ok.body.id}/cancel`)).expect(201);
      await auth(http().put(`/operations/${opId}`)).send({ monto: '20' }).expect(200);
    });

    it('un e-ticket sin operación no se controla contra nada', async () => {
      const cliente = await createTestCliente();
      await auth(http().post('/e-tickets'))
        .send({ clienteId: cliente.id, direccionEntrega: 'Calle sintética 123', tramos: [efectivo(1, 'ENTREGA', 'USD', '123')] })
        .expect(201);
    });

    it('U6: la oficina no recibe depósitos', async () => {
      const cliente = await createTestCliente();
      const res = await auth(http().post('/e-tickets'))
        .send({ clienteId: cliente.id, tramos: [{ orden: 1, sentido: 'RETIRO', canal: 'DEPOSITO', moneda: 'ARS', monto: '10' }] })
        .expect(400);
      expect(res.body.message).toContain('no recibe depósitos');
    });

    it('con cobertura saldo la pata en USD no lleva tramos', async () => {
      const cliente = await createTestCliente();
      const opId = await crearOp({ tipo: 'C', monto: '10', cotiz: '1000', cobertura: 'saldo', clienteId: cliente.id });
      const base = { clienteId: cliente.id, operationId: opId, direccionEntrega: 'Calle sintética 123' };
      await auth(http().post('/e-tickets'))
        .send({ ...base, tramos: [efectivo(1, 'ENTREGA', 'ARS', '10000'), efectivo(2, 'RETIRO', 'USD', '10')] })
        .expect(400);
      await auth(http().post('/e-tickets'))
        .send({ ...base, tramos: [efectivo(1, 'ENTREGA', 'ARS', '10000')] })
        .expect(201);
    });
  });

  describe('#19 — saldo del cliente', () => {
    it('movimientos manuales, operaciones contra saldo al finalizar, saldo negativo y anulación', async () => {
      const cliente = await createTestCliente();

      await auth(http().post(`/customers/${cliente.id}/saldo`)).send({ tipo: 'credito', montoUsd: '100', nota: 'Entrega efectivo' }).expect(201);
      expect(await saldoDe(cliente.id)).toBe('100.00');

      // Venta de 50 USD: la oficina entrega USD y quedan en el saldo (crédito).
      const venta = await crearOp({ tipo: 'V', monto: '50', cotiz: '1010', cobertura: 'saldo', clienteId: cliente.id });
      expect(await saldoDe(cliente.id)).toBe('100.00'); // pendiente: todavía no mueve saldo
      await finalizar(venta);
      expect(await saldoDe(cliente.id)).toBe('150.00');

      // Compra de 200 USD pagada con saldo (débito): el saldo puede quedar negativo.
      const compra = await crearOp({ tipo: 'C', monto: '200', cotiz: '1000', cobertura: 'saldo', clienteId: cliente.id });
      await finalizar(compra);
      expect(await saldoDe(cliente.id)).toBe('-50.00');

      // Volver la compra a pendiente anula su movimiento con un contraasiento.
      await auth(http().put(`/operations/${compra}`)).send({ status: 'pendiente' }).expect(200);
      expect(await saldoDe(cliente.id)).toBe('150.00');
      // Y se puede volver a finalizar.
      await finalizar(compra);
      expect(await saldoDe(cliente.id)).toBe('-50.00');

      const hist = await auth(http().get(`/customers/${cliente.id}/saldo`)).expect(200);
      expect(hist.body).toHaveLength(5);
      expect(hist.body[0]).toMatchObject({ tipo: 'debito', montoUsd: '-200', saldoPostUsd: '-50' });
    });

    it('contra saldo exige cliente; el monto manual es decimal y lo carga sólo el ADMIN', async () => {
      await auth(http().post('/operations')).send({ tipo: 'C', parId: 'USD/ARS', monto: '1', cotiz: '1000', cobertura: 'saldo' }).expect(400);
      const cliente = await createTestCliente();
      await auth(http().post(`/customers/${cliente.id}/saldo`)).send({ tipo: 'credito', montoUsd: '1,5' }).expect(400);
      await auth(http().post(`/customers/${cliente.id}/saldo`)).send({ tipo: 'credito', montoUsd: '0' }).expect(400);

      const op = await createTestUser({ username: 'saldos.operador', password: 'Passw0rd!', roles: ['OPERADOR'] });
      const login = await http().post('/auth/login').send({ username: op.username, password: op.password }).expect(200);
      await http().post(`/customers/${cliente.id}/saldo`).set('Authorization', `Bearer ${login.body.access_token}`)
        .send({ tipo: 'credito', montoUsd: '10' }).expect(403);
    });
  });

  describe('#19 — cierre y reporte', () => {
    it('sólo los saldos en caja mueven el saldo esperado; el reporte muestra el balance', async () => {
      const enCaja = await createTestCliente({ nombre: 'Cliente Caja' });
      const separado = await createTestCliente({ nombre: 'Cliente Separado' });
      await auth(http().put(`/customers/${separado.id}`)).send({ custodia: 'separada' }).expect(200);
      await auth(http().put(`/customers/${separado.id}`)).send({ custodia: 'otra' }).expect(400);

      await auth(http().post(`/customers/${enCaja.id}/saldo`)).send({ tipo: 'credito', montoUsd: '100' }).expect(201);
      await auth(http().post(`/customers/${separado.id}/saldo`)).send({ tipo: 'credito', montoUsd: '300' }).expect(201);
      // Compra de 10 USD pagada con el saldo del cliente en caja: salen los ARS y no entran USD.
      await finalizar(await crearOp({ tipo: 'C', monto: '10', cotiz: '1000', cobertura: 'saldo', clienteId: enCaja.id }));

      const pre = await auth(http().get('/closing/preview')).query({ fecha, tcCierre: '1000', saldoInicialUsd: '500' }).expect(200);
      expect(pre.body.saldoClientes).toHaveLength(3);
      expect(pre.body.saldoClientesNetoCajaUsd).toBe('90.00');
      expect(pre.body.posicionEsperadaUsd).toBe('590.00');

      const cierre = await auth(http().post('/closing'))
        .send({ fecha, tcCierre: '1000', saldoInicialUsd: '500', saldosReales: [{ moneda: 'USD', montoUsd: '590' }] })
        .expect(201);
      expect(cierre.body.diferenciaUsd).toBe('0');
      expect(await testPrisma.clienteSaldoMovimiento.count({ where: { cierreId: cierre.body.id } })).toBe(3);

      const rep = await auth(http().get(`/closing/${cierre.body.id}/reporte`)).expect(200);
      expect(rep.body.saldosClientes.map((s: { clienteNombre: string; custodia: string; saldoUsdCierre: string }) =>
        [s.clienteNombre, s.custodia, s.saldoUsdCierre])).toEqual([
        ['Cliente Caja', 'caja', '90.00'],
        ['Cliente Separado', 'separada', '300.00'],
      ]);
      expect(rep.body).toMatchObject({
        cajaContadaUsd: '590.00',
        totalSaldosCajaUsd: '90.00',
        totalSaldosSeparadosUsd: '300.00',
        balanceUsd: '500.00',
      });

    });
  });
});
