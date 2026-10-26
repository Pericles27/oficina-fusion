import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar, testPrisma } from '../utils/db';

/**
 * #12 — Cierre diario: movimientos del día, saldos reales en USD (varios
 * renglones por moneda) y diferencia entre saldo esperado y real.
 */
describe('Closing E2E (#12)', () => {
  let app: INestApplication;
  let token: string;

  // Mediodía local de hoy, sin zona: el backend lo interpreta en su hora local.
  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fecha = `${ymd}T12:00:00`;

  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  async function crearOp(tipo: 'C' | 'V', monto: string, cotiz: string, finalizar = true) {
    const res = await auth(http().post('/operations'))
      .send({ tipo, parId: 'USD/ARS', monto, cotiz, cobertura: 'efectivo' })
      .expect(201);
    if (finalizar) await auth(http().post(`/operations/${res.body.id}/finalize`)).expect(201);
    return res.body.id as string;
  }

  /** Compra 100 USD a 1000, vende 100 USD a 1010, una pendiente, gasto de 10.000 ARS. */
  async function diaDePrueba() {
    await crearOp('C', '100', '1000');
    await crearOp('V', '100', '1010');
    await crearOp('C', '5', '1000', false);
    await testPrisma.gasto.create({
      data: { codigo: 'GS-CL-1', concepto: 'Insumos de oficina', monto: '10000', categoria: 'Insumos', fecha: new Date(`${ymd}T09:00:00`) },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // cleanDatabase (db.js compilado) no conoce estas tablas. Igual que ella, se
    // desactivan los triggers de inmutabilidad para borrar filas ya cerradas.
    await testPrisma.$transaction([
      testPrisma.$executeRawUnsafe('SET session_replication_role = replica'),
      testPrisma.cierreSaldoReal.deleteMany(),
      testPrisma.usdtOperacion.deleteMany(),
      testPrisma.cableMovimiento.deleteMany(),
      testPrisma.cable.deleteMany(),
      testPrisma.$executeRawUnsafe('SET session_replication_role = origin'),
    ]);
    await cleanDatabase();
    await createTestPar({ par: 'USD/ARS', compra: '1000.00', venta: '1010.00' });
    const admin = await createTestUser({ username: 'cierre.admin', password: 'Passw0rd!' });
    const loginRes = await http()
      .post('/auth/login')
      .send({ username: admin.username, password: admin.password })
      .expect(200);
    token = loginRes.body.access_token;
  });

  it('preview: movimientos por moneda, resultado y saldo esperado, sin escribir', async () => {
    await diaDePrueba();

    const res = await auth(http().get('/closing/preview'))
      .query({ fecha, tcCierre: '1000', saldoInicialUsd: '500' })
      .expect(200);

    expect(res.body.nOpsFinalizadas).toBe(2);
    expect(res.body.nOpsSinFinalizar).toBe(1);
    expect(res.body.movimientos).toEqual([
      { moneda: 'ARS', entradas: '101000.00', salidas: '100000.00', neto: '1000.00' },
      { moneda: 'USD', entradas: '100.00', salidas: '100.00', neto: '0.00' },
    ]);
    // Spread 10 ARS × 100 calzados = 1000 ARS = 1 USD a TC 1000.
    expect(res.body.gananciaRealizadaUsd).toBe('1.00');
    expect(res.body.totalGastosArs).toBe('10000.00');
    expect(res.body.totalGastosUsd).toBe('10.00');
    expect(res.body.gastos).toHaveLength(1);
    expect(res.body.resultadoOperativoUsd).toBe('-9.00');
    // 500 + 1 − 0 − 10
    expect(res.body.posicionEsperadaUsd).toBe('491.00');
    expect(res.body.saldoInicialSugeridoUsd).toBeNull();
    expect(res.body.cierreExistenteId).toBeNull();
    expect(await testPrisma.cierre.count()).toBe(0);
  });

  it('crea el cierre con varios renglones por moneda; la caja contada es su suma', async () => {
    await diaDePrueba();

    const res = await auth(http().post('/closing'))
      .send({
        fecha,
        tcCierre: '1000',
        saldoInicialUsd: '500',
        saldosReales: [
          { moneda: 'USD', montoUsd: '400' },
          { moneda: 'EUR', montoUsd: '54.00', detalle: '50 EUR a 1,08' },
          { moneda: 'EUR', montoUsd: '36', detalle: '32 EUR a 1,125' },
        ],
      })
      .expect(201);

    expect(res.body.cajaContadaUsd).toBe('490');
    expect(res.body.posicionEsperadaUsd).toBe('491');
    expect(res.body.diferenciaUsd).toBe('-1');
    expect(res.body.nOps).toBe(2);
    expect(res.body.saldosReales.map((s: { moneda: string; montoUsd: string; detalle: string | null }) => [s.moneda, s.montoUsd, s.detalle]))
      .toEqual([['USD', '400', null], ['EUR', '54', '50 EUR a 1,08'], ['EUR', '36', '32 EUR a 1,125']]);

    const detalle = await auth(http().get(`/closing/${res.body.id}`)).expect(200);
    expect(detalle.body.saldosReales).toHaveLength(3);

    // Las finalizadas quedan ligadas al cierre; la pendiente no.
    expect(await testPrisma.operacion.count({ where: { cierreId: res.body.id } })).toBe(2);

    const pre = await auth(http().get('/closing/preview')).query({ fecha, tcCierre: '1000' }).expect(200);
    expect(pre.body.cierreExistenteId).toBe(res.body.id);
    // Con el día cerrado, el preview muestra los movimientos del cierre guardado.
    expect(pre.body.nOpsFinalizadas).toBe(2);
    expect(pre.body.gananciaRealizadaUsd).toBe('1.00');
  });

  it('sugiere como saldo inicial la caja contada del cierre anterior', async () => {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const ymdAyer = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
    await auth(http().post('/closing'))
      .send({ fecha: `${ymdAyer}T12:00:00`, tcCierre: '1000', saldoInicialUsd: '0', saldosReales: [{ moneda: 'USD', montoUsd: '750.50' }] })
      .expect(201);

    const res = await auth(http().get('/closing/preview')).query({ fecha, tcCierre: '1000' }).expect(200);
    expect(res.body.saldoInicialSugeridoUsd).toBe('750.50');
    expect(res.body.saldoInicialUsd).toBe('750.50');
    expect(res.body.posicionEsperadaUsd).toBe('750.50');
  });

  it('rechaza un total contado que no coincide con la suma de los renglones', async () => {
    await auth(http().post('/closing'))
      .send({ fecha, tcCierre: '1000', saldoInicialUsd: '0', cajaContadaUsd: '100', saldosReales: [{ moneda: 'USD', montoUsd: '90' }] })
      .expect(400);
    expect(await testPrisma.cierre.count()).toBe(0);
  });

  it('rechaza montos negativos o no decimales y un cierre sin saldos', async () => {
    for (const montoUsd of ['-1', 'abc', '1,5']) {
      await auth(http().post('/closing'))
        .send({ fecha, tcCierre: '1000', saldoInicialUsd: '0', saldosReales: [{ moneda: 'USD', montoUsd }] })
        .expect(400);
    }
    await auth(http().post('/closing'))
      .send({ fecha, tcCierre: '1000', saldoInicialUsd: '0' })
      .expect(400);
    await auth(http().post('/closing'))
      .send({ fecha, tcCierre: '1000', saldoInicialUsd: '0', saldosReales: [{ moneda: 'XXX', montoUsd: '1' }] })
      .expect(400);
    expect(await testPrisma.cierre.count()).toBe(0);
  });

  it('preview exige fecha y valida los decimales del query', async () => {
    await auth(http().get('/closing/preview')).expect(400);
    await auth(http().get('/closing/preview')).query({ fecha, tcCierre: '1,5' }).expect(400);
  });

  describe('#13 — cables, USDT y gastos en USD', () => {
    /** Spread 1 USD + gasto viejo de 10 USD (diaDePrueba), más cable, USDT y gastos en USD. */
    async function movimientosDelDia() {
      await diaDePrueba();
      await auth(http().post('/movimientos/cables')).send({ ingresoUsd: '1000', egresoUsd: '980', comisionUsd: '5', fecha }).expect(201);
      await auth(http().post('/movimientos/usdt')).send({ ingresoUsd: '500', egresoUsd: '495', comisionUsd: '1', fecha }).expect(201);
      await auth(http().post('/movimientos/gastos')).send({ concepto: 'Librería', montoUsd: '20', tipo: 'OFICINA', fecha }).expect(201);
      await auth(http().post('/movimientos/gastos')).send({ concepto: 'Almuerzo jefe', montoUsd: '7', tipo: 'JEFE', fecha }).expect(201);
      await auth(http().post('/movimientos/gastos')).send({ concepto: 'Adelanto jefe', montoUsd: '30', tipo: 'JEFE_A_DEVOLVER', fecha }).expect(201);
    }

    it('preview: ganancia implícita de cables/USDT, gastos del día y deuda del jefe', async () => {
      await movimientosDelDia();
      const res = await auth(http().get('/closing/preview')).query({ fecha, tcCierre: '1000', saldoInicialUsd: '500' }).expect(200);

      expect(res.body.cables).toHaveLength(1);
      expect(res.body.cables[0]).toMatchObject({ ingresoUsd: '1000.00', egresoUsd: '980.00', comisionUsd: '5.00', gananciaUsd: '15.00' });
      expect(res.body.totalCables.gananciaUsd).toBe('15.00');
      expect(res.body.totalUsdt).toEqual({ ingresoUsd: '500.00', egresoUsd: '495.00', comisionUsd: '1.00', gananciaUsd: '4.00' });

      // Gastos del día: 10 (viejo, en ARS) + 20 oficina + 7 jefe. El adelanto de 30 es deuda, no gasto.
      expect(res.body.totalGastosUsd).toBe('37.00');
      expect(res.body.deudaJefeUsd).toBe('30.00');
      expect(res.body.gastos.map((g: { tipo: string; montoUsd: string; montoArs: string | null }) => [g.tipo, g.montoUsd, g.montoArs]))
        .toEqual([['OFICINA', '10.00', '10000.00'], ['OFICINA', '20.00', null], ['JEFE', '7.00', null], ['JEFE_A_DEVOLVER', '30.00', null]]);

      // Ganancia: cambio 1 + cables 15 + USDT 4 = 20. Resultado: 20 − 37 = −17.
      expect(res.body.gananciaTotalUsd).toBe('20.00');
      expect(res.body.resultadoOperativoUsd).toBe('-17.00');
      // Esperado: 500 − 17 − 30 (sale de la caja aunque sea deuda) = 453.
      expect(res.body.posicionEsperadaUsd).toBe('453.00');
    });

    it('al cerrar quedan ligados al cierre, no se pueden borrar y el cierre guarda sus totales', async () => {
      await movimientosDelDia();
      const cierre = await auth(http().post('/closing'))
        .send({ fecha, tcCierre: '1000', saldoInicialUsd: '500', saldosReales: [{ moneda: 'USD', montoUsd: '453' }] })
        .expect(201);
      expect(cierre.body.diferenciaUsd).toBe('0');
      expect(cierre.body.gananciaCablesUsd).toBe('15');
      expect(cierre.body.gananciaUsdtUsd).toBe('4');
      expect(cierre.body.deudaJefeUsd).toBe('30');
      expect(cierre.body.resultadoOperativoUsd).toBe('-17');

      expect(await testPrisma.cable.count({ where: { cierreId: cierre.body.id } })).toBe(1);
      expect(await testPrisma.usdtOperacion.count({ where: { cierreId: cierre.body.id } })).toBe(1);
      expect(await testPrisma.gasto.count({ where: { cierreId: cierre.body.id } })).toBe(4);

      const pre = await auth(http().get('/closing/preview')).query({ fecha }).expect(200);
      expect(pre.body.cables).toHaveLength(1);
      expect(pre.body.gastos).toHaveLength(4);

      const cable = await testPrisma.cable.findFirstOrThrow();
      await auth(http().delete(`/movimientos/cables/${cable.id}`)).expect(400);
      expect(await testPrisma.cable.count()).toBe(1);
    });

    it('antes de cerrar se pueden borrar; valida montos, tipo y concepto', async () => {
      const c = await auth(http().post('/movimientos/cables')).send({ ingresoUsd: '10', egresoUsd: '9' }).expect(201);
      expect(c.body.codigo).toBe('CB-0001');
      expect(c.body.status).toBe('finalizada');
      await auth(http().delete(`/movimientos/cables/${c.body.id}`)).expect(204);
      expect(await testPrisma.cable.count()).toBe(0);

      const g = await auth(http().post('/movimientos/gastos')).send({ concepto: 'Taxi', montoUsd: '3.50' }).expect(201);
      expect(g.body.tipo).toBe('OFICINA');
      await auth(http().delete(`/movimientos/gastos/${g.body.id}`)).expect(204);

      await auth(http().post('/movimientos/usdt')).send({ ingresoUsd: '10', egresoUsd: '0' }).expect(400);
      await auth(http().post('/movimientos/usdt')).send({ ingresoUsd: '10', egresoUsd: '9', comisionUsd: '-1' }).expect(400);
      await auth(http().post('/movimientos/gastos')).send({ concepto: 'X', montoUsd: '5', tipo: 'OTRO' }).expect(400);
      await auth(http().post('/movimientos/gastos')).send({ concepto: '', montoUsd: '5' }).expect(400);
      await auth(http().delete('/movimientos/usdt/no-existe')).expect(404);
    });
  });
});
