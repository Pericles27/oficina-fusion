/**
 * C2a ONLY. Runner: sanitized snapshot, setupFiles: [], sequential file execution,
 * aliases @prisma/client -> runner's PRIVATE generated client and @common -> src/common.
 * cwd = snapshot/backend; ../c2a-safe-marker.json must contain
 * { "safeSnapshot": true, "databaseUrl": "postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_c2a_gpt" }.
 * Never import AppModule, test-app or setup.ts (they can load real environment/DB).
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { ETicketsController } from '../../src/modules/e-tickets/e-tickets.controller';
import { ETicketsService } from '../../src/modules/e-tickets/e-tickets.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import type { TramoInput } from '../../src/modules/e-tickets/dto/eticket.dto';

const DATABASE_URL = 'postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_c2a_gpt';
// Executed during collection, BEFORE constructing PrismaService or app.init/$connect.
function assertSafeSnapshot() {
  if (process.env.C2A_SAFE_SNAPSHOT !== '1' || process.env.DATABASE_URL !== DATABASE_URL || process.env.C2A_DATABASE_URL !== DATABASE_URL) {
    throw new Error('C2a fail-closed: safe snapshot and BOTH exact dedicated database URLs required');
  }
  const root = realpathSync(resolve(process.cwd(), '..'));
  const source = realpathSync(__filename);
  if (!source.startsWith(`${root}/backend/test/integration/`) || root === '/Users/nicolas/Proyectos/Oficina/oficina-fusion') {
    throw new Error('C2a fail-closed: run only from sanitized snapshot/backend, never live repository');
  }
  const marker = JSON.parse(readFileSync(resolve(root, 'c2a-safe-marker.json'), 'utf8'));
  if (marker.safeSnapshot !== true || marker.databaseUrl !== DATABASE_URL) {
    throw new Error('C2a fail-closed: invalid ../c2a-safe-marker.json');
  }
}
assertSafeSnapshot();

const depKeys = ['depBeneficiario', 'depCuit', 'depBanco', 'depNumeroCuenta', 'depCbu', 'depAlias', 'depTipoCuenta', 'depMonedaCuenta'] as const;
const legacyKeys = ['banco', 'cuentaDeposito', 'monedaEntregar', 'montoEntregar', 'monedaRecibir', 'montoRecibir'];
// U5 (2026-10-16): el cadete ve los tramos (cuánto deja/se lleva y a qué cuenta); las columnas legado salen.
const cadeteKeys = ['id', 'numero', 'codigo', 'ts', 'estado', 'clienteId', 'metodoEntrega', 'direccionEntrega', 'telefonoContacto', 'nombreRecibe', 'horarioEntrega', 'instrucciones', 'confirmadoPor', 'confirmadoEn', 'creadoEn', 'tramos'].sort();
const cadeteTramoKeys = ['orden', 'sentido', 'canal', 'moneda', 'monto', 'depBeneficiario', 'depCuit', 'depBanco', 'depTipoCuenta', 'depMonedaCuenta', 'depNumeroCuenta', 'depCbu', 'depAlias'].sort();
const forbiddenForCadete = /cotiz|clientRate|marketRate|puntos|comision|spread|ganancia|operadorDueno|saldo|montoEntregar|montoRecibir|"operation"|cuentaDestinoId/i;
const masterA = { titular: 'Titular sintético A', cuitTitular: '20123456789', banco: 'Banco sintético A', tipoCuenta: 'CAJA_AHORRO' as const, monedaCuenta: 'ARS' as const, numeroCuenta: '000111', cbu: '1234567890123456789012', alias: 'sintetico.a' };
const masterB = { titular: 'Titular sintético B', cuitTitular: '20987654321', banco: 'Banco sintético B', tipoCuenta: 'CUENTA_CORRIENTE' as const, monedaCuenta: 'USD' as const, numeroCuenta: '000222', cbu: '2234567890123456789012', alias: 'sintetico.b' };
const snapshotA = { depBeneficiario: masterA.titular, depCuit: masterA.cuitTitular, depBanco: masterA.banco, depTipoCuenta: masterA.tipoCuenta, depMonedaCuenta: masterA.monedaCuenta, depNumeroCuenta: masterA.numeroCuenta, depCbu: masterA.cbu, depAlias: masterA.alias };
const snapshotB = { depBeneficiario: masterB.titular, depCuit: masterB.cuitTitular, depBanco: masterB.banco, depTipoCuenta: masterB.tipoCuenta, depMonedaCuenta: masterB.monedaCuenta, depNumeroCuenta: masterB.numeroCuenta, depCbu: masterB.cbu, depAlias: masterB.alias };
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe.sequential('C2a — real Nest HTTP, real service, real PostgreSQL SELECT', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let clienteId: string;
  let otroClienteId: string;
  let cuentaA: string;
  let cuentaB: string;
  let cuentaAjena: string;
  let operationId: string;
  const run = randomUUID();
  const adminId = `c2a-admin-${run}`;
  const cadeteId = `c2a-cadete-${run}`;
  const jwt = new JwtService();
  const authorization = (role: 'ADMIN' | 'CADETE') => `Bearer ${jwt.sign({
    id: role === 'ADMIN' ? adminId : cadeteId, roles: [role],
  }, { secret: process.env.JWT_SECRET, expiresIn: '10m' })}`;
  const parId = `C2A-${run}`;
  const db = () => {
    if (!prisma) throw new Error('Prisma not initialized');
    return prisma;
  };
  const http = () => {
    if (!app) throw new Error('Nest not initialized');
    return request(app.getHttpServer());
  };
  const cash = (orden = 1, monto = '12345678901234.1234'): TramoInput => ({ orden, sentido: 'ENTREGA', canal: 'EFECTIVO', moneda: 'USD', monto });
  const deposit = (orden = 1, cuentaDestinoId = cuentaA): TramoInput => ({ orden, sentido: 'ENTREGA', canal: 'DEPOSITO', moneda: 'ARS', monto: '99999999999999.9999', cuentaDestinoId });
  const input = (row: Awaited<ReturnType<typeof rows>>[number], extra: Partial<TramoInput> = {}): TramoInput => ({
    id: row.id, orden: row.orden, sentido: row.sentido, canal: row.canal, moneda: row.moneda, monto: row.monto.toFixed(), ...extra,
  });
  async function rows(id: string) {
    return db().eticketTramo.findMany({ where: { eticketId: id }, orderBy: { orden: 'asc' } });
  }
  // Complete persisted header/tramos, including timestamps, IDs, legacy columns and
  // any unexpected extra row owned by this run. Not merely a mocked call count.
  async function persisted() {
    return db().$queryRaw<Array<{ header: Prisma.JsonValue; tramos: Prisma.JsonValue }>>`
      SELECT to_jsonb(e) AS header,
        COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.orden, t.id)
          FROM eticket_tramo t WHERE t."eticketId" = e.id), '[]'::jsonb) AS tramos
      FROM eticket e WHERE e."creadoPor" = ${adminId} ORDER BY e.id`;
  }
  async function post(body: Record<string, unknown>, status = 201) {
    return http().post('/e-tickets').set('Authorization', authorization('ADMIN')).send(body).expect(status);
  }
  async function put(id: string, body: Record<string, unknown>, status = 200) {
    return http().put(`/e-tickets/${id}`).set('Authorization', authorization('ADMIN')).send(body).expect(status);
  }
  async function create(tramos: TramoInput[] = [deposit()], extra: Record<string, unknown> = {}) {
    const hasCash = tramos.some((t) => t.canal === 'EFECTIVO');
    const response = await post({ clienteId, ...(hasCash ? { direccionEntrega: 'Calle sintética 123' } : {}), tramos, ...extra });
    expect(typeof response.body.id).toBe('string');
    return response.body.id as string;
  }
  async function rejectPut(id: string, body: Record<string, unknown>, status = 400) {
    const before = await persisted();
    const response = await put(id, body, status);
    expect(await persisted()).toEqual(before);
    return response;
  }
  async function rejectPost(body: Record<string, unknown>) {
    const before = await persisted();
    const response = await post(body, 400);
    expect(await persisted()).toEqual(before);
    return response;
  }

  beforeAll(async () => {
    assertSafeSnapshot();
    const module = await Test.createTestingModule({
      controllers: [ETicketsController],
      providers: [ETicketsService, JwtService, JwtAuthGuard, RolesGuard, {
        provide: PrismaService,
        useFactory: () => {
          assertSafeSnapshot();
          return new PrismaService({ datasourceUrl: DATABASE_URL });
        },
      }],
    }).compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    await app.init();
    await db().usuario.createMany({ data: [
      { id: adminId, username: adminId, nombre: 'Admin sintético C2a', passwordHash: 'synthetic-not-a-login', roles: ['ADMIN'] },
      { id: cadeteId, username: cadeteId, nombre: 'Cadete sintético C2a', passwordHash: 'synthetic-not-a-login', roles: ['CADETE'] },
    ] });
    clienteId = (await db().cliente.create({ data: { nombre: `Cliente sintético ${run}`, tipo: 'Persona' } })).id;
    otroClienteId = (await db().cliente.create({ data: { nombre: `Otro sintético ${run}`, tipo: 'Persona' } })).id;
    cuentaA = (await db().cuentaCliente.create({ data: { clienteId, numero: `a-${run}`, ...masterA } })).id;
    cuentaB = (await db().cuentaCliente.create({ data: { clienteId, numero: `b-${run}`, ...masterB } })).id;
    cuentaAjena = (await db().cuentaCliente.create({ data: { clienteId: otroClienteId, numero: `ajena-${run}`, ...masterB } })).id;
    await db().par.create({ data: { par: parId, base: 'USD', quote: 'ARS', nombre: 'Par sintético C2a', compra: '1000', venta: '1010', varPct: '0' } });
    const last = await db().operacion.findFirst({ orderBy: { numero: 'desc' }, select: { numero: true } });
    operationId = (await db().operacion.create({ data: {
      codigo: `C2A-${run}`, numero: (last?.numero ?? 0) + 1, tipo: 'C', parId,
      monto: '1', cotiz: '1000', contra: '1000', clientRate: '1000', cobertura: 'efectivo', operadorId: adminId, clienteId,
    } })).id;
  });

  afterAll(async () => {
    // No truncate, no global cleanup. All deletes scoped to this run's creator/IDs.
    if (prisma) {
      try {
        await db().eticket.deleteMany({ where: { creadoPor: adminId } });
        await db().operacion.deleteMany({ where: { operadorId: adminId } });
        await db().cliente.deleteMany({ where: { id: { in: [clienteId, otroClienteId].filter(Boolean) } } });
        await db().par.deleteMany({ where: { par: parId } });
        await db().usuario.deleteMany({ where: { id: { in: [adminId, cadeteId] } } });
      } finally {
        if (app) await app.close();
        else await db().$disconnect();
      }
    }
  });

  it('alta copia las siete claves de cuenta; cabecera no escribe columnas legacy', async () => {
    const id = await create();
    expect((await rows(id))[0]).toMatchObject({ cuentaDestinoId: cuentaA, ...snapshotA });
    const header = await db().eticket.findUniqueOrThrow({ where: { id } });
    expect(header.metodoEntrega).toBe('deposito_banco');
    for (const key of legacyKeys) expect((header as unknown as Record<string, unknown>)[key]).toBeNull();
  });

  it('editar maestra + PUT sólo cabecera conserva snapshot e IDs; mismo id+cuenta tampoco recopia', async () => {
    const id = await create();
    const before = json(await rows(id));
    await db().cuentaCliente.update({ where: { id: cuentaA }, data: masterB });
    try {
      // Sin operationId: con U7 el tramo sintético no suma la operación sintética.
      await put(id, { instrucciones: 'Nueva cabecera', telefonoContacto: '000-sintetico' });
      expect(json(await rows(id))).toEqual(before);
      expect(await db().eticket.findUniqueOrThrow({ where: { id } })).toMatchObject({ instrucciones: 'Nueva cabecera' });
      const current = (await rows(id))[0];
      await put(id, { tramos: [input(current, { cuentaDestinoId: cuentaA })] });
      expect(json(await rows(id))).toEqual(before);
      // Missing cuentaDestinoId on an existing ID means preserve, not clear/reload.
      await put(id, { tramos: [input(current)] });
      expect(json(await rows(id))).toEqual(before);
    } finally {
      await db().cuentaCliente.update({ where: { id: cuentaA }, data: masterA });
    }
  });

  it('override single key y cabecera posterior conservan resto; cambiar cuenta elimina override previo', async () => {
    const id = await create();
    const first = (await rows(id))[0];
    await put(id, { tramos: [input(first, { depOverrides: { depBeneficiario: 'Beneficiario override sintético' } })] });
    expect((await rows(id))[0]).toMatchObject({ ...snapshotA, depBeneficiario: 'Beneficiario override sintético', id: first.id });
    const overridden = json(await rows(id));
    await put(id, { nombreRecibe: 'Cabecera sintética' });
    expect(json(await rows(id))).toEqual(overridden);
    await put(id, { tramos: [input(first, { cuentaDestinoId: cuentaB })] });
    expect((await rows(id))[0]).toMatchObject({ id: first.id, cuentaDestinoId: cuentaB, ...snapshotB });
  });

  it('PUT cabecera permite clienteId/operationId y demás campos sin recrear tramos', async () => {
    const id = await create([cash()]);
    const before = json(await rows(id));
    await put(id, { clienteId: otroClienteId, operationId: null, telefonoContacto: '000-sintetico', nombreRecibe: 'Persona sintética', horarioEntrega: '10-12', instrucciones: 'Sólo cabecera' });
    expect(await db().eticket.findUniqueOrThrow({ where: { id } })).toMatchObject({ clienteId: otroClienteId, operationId: null, telefonoContacto: '000-sintetico', nombreRecibe: 'Persona sintética', horarioEntrega: '10-12', instrucciones: 'Sólo cabecera' });
    expect(json(await rows(id))).toEqual(before);
  });

  it('alta aplica override encima de maestra; cambio de cuenta aplica sólo override del request actual', async () => {
    const id = await create([{ ...deposit(), depOverrides: { depBeneficiario: 'Override inicial', depBanco: 'Banco override inicial' } }]);
    expect((await rows(id))[0]).toMatchObject({ ...snapshotA, depBeneficiario: 'Override inicial', depBanco: 'Banco override inicial' });
    await put(id, { tramos: [input((await rows(id))[0], { cuentaDestinoId: cuentaB, depOverrides: { depAlias: 'alias.nuevo' } })] });
    expect((await rows(id))[0]).toMatchObject({ ...snapshotB, depAlias: 'alias.nuevo' });
  });

  it('reorder dos IDs conserva contenido y omitir uno lo borra', async () => {
    const id = await create([deposit(1), deposit(2, cuentaB)]);
    const [a, b] = await rows(id);
    await put(id, { tramos: [input(b, { orden: 1 }), input(a, { orden: 2 })] });
    const reordered = await rows(id);
    expect(json(reordered)).toEqual(json([{ ...b, orden: 1 }, { ...a, orden: 2 }]));
    await put(id, { tramos: [input(reordered[0])] });
    expect(json(await rows(id))).toEqual(json([reordered[0]]));
    expect(await db().eticketTramo.findUnique({ where: { id: a.id } })).toBeNull();
  });

  it('lista toda sin IDs reemplaza viejos por dos altas, no actualiza por posición', async () => {
    const id = await create([deposit(1), deposit(2, cuentaB)]);
    const oldIds = (await rows(id)).map((r) => r.id);
    await put(id, { tramos: [deposit(1, cuentaB), deposit(2)] });
    const next = await rows(id);
    expect(next).toHaveLength(2);
    expect(next.every((r) => !oldIds.includes(r.id))).toBe(true);
    expect(next.map((r) => r.cuentaDestinoId)).toEqual([cuentaB, cuentaA]);
    expect(await db().eticketTramo.count({ where: { id: { in: oldIds } } })).toBe(0);
  });

  it('id de otro ticket y duplicado →400, ni cabecera ni tramos escritos', async () => {
    const id = await create();
    const other = await create();
    await rejectPut(id, { instrucciones: 'NO escribir', tramos: [input((await rows(other))[0])] });
    const own = (await rows(id))[0];
    await rejectPut(id, { instrucciones: 'NO escribir', tramos: [input(own), input(own, { orden: 2 })] });
  });

  it.each(['en_curso', 'confirmado'] as const)('estado %s →409 sin writes para cabecera ni lista', async (estado) => {
    const id = await create();
    await db().eticket.update({ where: { id }, data: { estado } });
    await rejectPut(id, { instrucciones: 'NO escribir' }, 409);
    await rejectPut(id, { instrucciones: 'NO escribir', tramos: [deposit(1, cuentaB)] }, 409);
  });

  it('nested extra/CBU inválido/dep* directo →400 sin writes en POST y PUT', async () => {
    const id = await create();
    const existing = (await rows(id))[0];
    const invalid: Record<string, unknown>[] = [
      { depOverrides: { depBeneficiario: 'X', extra: 'NO' } },
      { depOverrides: { depCbu: '123456789012345678901' } },
      { depOverrides: { depCbu: '123456789012345678901a' } },
      ...depKeys.map((key) => ({ [key]: key === 'depCbu' ? masterA.cbu : 'NO directo' })),
    ];
    for (const extra of invalid) {
      await rejectPost({ clienteId, tramos: [{ ...deposit(), ...extra }] });
      await rejectPut(id, { instrucciones: 'NO escribir', tramos: [{ ...input(existing), ...extra }] });
    }
  });

  it('mixto sin dirección/deposito con dirección/[]/cuenta ajena/DEPOSITO RETIRO →400 sin writes', async () => {
    const id = await create();
    const invalid: Record<string, unknown>[] = [
      { tramos: [cash(), deposit(2)] },
      { direccionEntrega: 'NO corresponde', tramos: [deposit()] },
      { tramos: [] },
      { tramos: [deposit(1, cuentaAjena)] },
      { tramos: [{ ...deposit(), sentido: 'RETIRO' }] },
      { tramos: [{ ...deposit(), cuentaDestinoId: null }] },
      { tramos: [{ ...deposit(), cuentaDestinoId: undefined }] },
    ];
    for (const body of invalid) {
      const response = await rejectPost({ clienteId, ...body });
      const updated = await rejectPut(id, { instrucciones: 'NO escribir', ...body });
      if ((body.tramos as TramoInput[])[0]?.sentido === 'RETIRO') {
        // U6 cerrada (2026-10-25): la oficina no recibe depósitos.
        expect(JSON.stringify(response.body)).toContain('no recibe depósitos');
        expect(JSON.stringify(updated.body)).toContain('no recibe depósitos');
      }
    }
    const cashId = await create([cash()]);
    await rejectPut(cashId, { direccionEntrega: null }); // resulting set is consulted without tramos
    await rejectPut(id, { direccionEntrega: 'NO corresponde' });
  });

  it.each(['', '   '])('dirección lógicamente ausente %j se persiste SQL NULL en POST/PUT sólo DEPOSITO', async (blank) => {
    const response = await post({ clienteId, direccionEntrega: blank, tramos: [deposit()] });
    const id = response.body.id as string;
    const assertNull = async (body: { direccionEntrega: unknown }) => {
      expect(body.direccionEntrega).toBeNull();
      const selected = await db().$queryRaw<Array<{ direccionEntrega: string | null; isNull: boolean }>>`
        SELECT "direccionEntrega", "direccionEntrega" IS NULL AS "isNull" FROM eticket WHERE id = ${id}`;
      expect(selected).toEqual([{ direccionEntrega: null, isNull: true }]);
    };
    await assertNull(response.body);
    const beforeTramos = json(await rows(id));
    await assertNull((await put(id, { direccionEntrega: blank })).body);
    // A header-only PUT also canonicalizes historical empty/whitespace strings.
    await db().eticket.update({ where: { id }, data: { direccionEntrega: blank } });
    await assertNull((await put(id, { instrucciones: 'Normalizar dirección histórica vacía' })).body);
    expect(json(await rows(id))).toEqual(beforeTramos);
    await rejectPost({ clienteId, direccionEntrega: blank, tramos: [cash()] });
    const cashId = await create([cash()]);
    const realAddress = (await db().eticket.findUniqueOrThrow({ where: { id: cashId } })).direccionEntrega;
    const headerOnly = await put(cashId, { instrucciones: 'Conservar dirección real' });
    expect(headerOnly.body.direccionEntrega).toBe(realAddress);
    expect((await db().eticket.findUniqueOrThrow({ where: { id: cashId } })).direccionEntrega).toBe(realAddress);
    await rejectPut(cashId, { direccionEntrega: blank });
    await rejectPut(cashId, { tramos: [deposit()] }); // absent input preserves real address, so rejects
    await rejectPost({ clienteId, direccionEntrega: 'Dirección real sintética', tramos: [deposit()] });
    await rejectPut(id, { direccionEntrega: 'Dirección real sintética' });
    // Evaluating and saving the same value allows an explicit cash -> deposit transition.
    const changed = await put(cashId, { direccionEntrega: blank, tramos: [deposit()] });
    expect(changed.body.direccionEntrega).toBeNull();
    expect((await db().eticket.findUniqueOrThrow({ where: { id: cashId } })).direccionEntrega).toBeNull();
  });

  it('mixto201 deriva método y conserva dos montos string exactos en HTTP y SELECT', async () => {
    const response = await post({ clienteId, direccionEntrega: 'Calle sintética 123', metodoEntrega: 'en_mano', tramos: [cash(2), deposit(1)] });
    const saved = await db().eticket.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(saved.metodoEntrega).toBe('mixto');
    expect(response.body.metodoEntrega).toBe('mixto');
    expect(response.body.tramos.map((r: { monto: unknown }) => r.monto)).toEqual(['99999999999999.9999', '12345678901234.1234']);
    const selected = await db().$queryRaw<Array<{ monto: string; orden: number }>>`
      SELECT monto::text AS monto, orden FROM eticket_tramo WHERE "eticketId" = ${response.body.id} ORDER BY orden`;
    expect(selected).toEqual([{ monto: '99999999999999.9999', orden: 1 }, { monto: '12345678901234.1234', orden: 2 }]);
  });

  it('montos no canónicos/fuera de18,4 →400 sin persistencia HTTP', async () => {
    const id = await create();
    for (const monto of [1, '0', '-1', '01', '1e2', '100000000000000', '1.00001']) {
      await rejectPost({ clienteId, tramos: [{ ...deposit(), monto }] });
      await rejectPut(id, { instrucciones: 'NO escribir', tramos: [{ ...deposit(), monto }] });
    }
  });

  it('overrides que borran todos identificadores resultantes →400 sin writes', async () => {
    const id = await create();
    const depOverrides = { depCbu: null, depNumeroCuenta: null, depAlias: null };
    await rejectPost({ clienteId, tramos: [{ ...deposit(), depOverrides }] });
    await rejectPut(id, { instrucciones: 'NO escribir', tramos: [input((await rows(id))[0], { depOverrides })] });
  });

  it('pasar a EFECTIVO limpia cuenta y todos dep*, método en_mano derivado', async () => {
    const id = await create([{ ...deposit(), depOverrides: { depAlias: 'override.viejo' } }]);
    const existing = (await rows(id))[0];
    await put(id, { direccionEntrega: 'Calle sintética 456', metodoEntrega: 'deposito_banco', tramos: [input(existing, { canal: 'EFECTIVO', cuentaDestinoId: cuentaA })] });
    const row = (await rows(id))[0];
    expect(row.cuentaDestinoId).toBeNull();
    for (const key of depKeys) expect(row[key]).toBeNull();
    expect((await db().eticket.findUniqueOrThrow({ where: { id } })).metodoEntrega).toBe('en_mano');
  });

  it('GET admin lista/detalle ordered sin legacy; GET cadete conserva whitelist exacta, sin operation/tramos/montos', async () => {
    const id = await create([deposit(2, cuentaB), deposit(1)]);
    // Attach an actual operation so privacy checks do not pass only because it is null.
    await db().eticket.updateMany({ where: { creadoPor: adminId, operationId }, data: { operationId: null } });
    // Directo en la base: con U7 la API rechaza vincular tramos sintéticos que no suman la operación.
    await db().eticket.update({ where: { id }, data: { operationId } });
    const detail = await http().get(`/e-tickets/${id}`).set('Authorization', authorization('ADMIN')).expect(200);
    const list = await http().get('/e-tickets').query({ clienteId, pageSize: 100 }).set('Authorization', authorization('ADMIN')).expect(200);
    const listed = list.body.data.find((r: { id: string }) => r.id === id);
    expect(listed).toBeDefined();
    for (const item of [detail.body, listed]) {
      expect(item.tramos.map((r: { orden: number }) => r.orden)).toEqual([1, 2]);
      expect(item.tramos.map((r: { monto: unknown }) => r.monto)).toEqual(['99999999999999.9999', '99999999999999.9999']);
      for (const key of legacyKeys) expect(item).not.toHaveProperty(key);
    }
    const cadete = await http().get(`/e-tickets/${id}`).set('Authorization', authorization('CADETE')).expect(200);
    const cadeteList = await http().get('/e-tickets').query({ pageSize: 100 }).set('Authorization', authorization('CADETE')).expect(200);
    const scoped = cadeteList.body.data.find((r: { id: string }) => r.id === id);
    expect(scoped).toBeDefined();
    for (const item of [cadete.body, scoped]) {
      expect(Object.keys(item).sort()).toEqual(cadeteKeys);
      for (const tramo of item.tramos) expect(Object.keys(tramo).sort()).toEqual(cadeteTramoKeys);
      expect(JSON.stringify(item)).not.toMatch(forbiddenForCadete);
      expect(item).not.toHaveProperty('operation');
      expect(item).not.toHaveProperty('operationId');
    }
    const before = await persisted();
    await http().put(`/e-tickets/${id}`).set('Authorization', authorization('CADETE')).send({ instrucciones: 'NO' }).expect(403);
    await http().post('/e-tickets').set('Authorization', authorization('CADETE')).send({ clienteId, tramos: [deposit()] }).expect(403);
    expect(await persisted()).toEqual(before);
  });

  it('regresión scope JWT: bolsa común, filtros forzados,404 y confirm sin tramos', async () => {
    const id = await create();
    await http().get('/e-tickets').expect(401);
    await http().get('/e-tickets').set('Authorization', 'Bearer invalid-synthetic').expect(401);
    await http().get('/e-tickets/no-such-synthetic-id').set('Authorization', authorization('CADETE')).expect(404);
    const before = await persisted();
    await http().post(`/e-tickets/${id}/cancel`).set('Authorization', authorization('CADETE')).expect(403);
    expect(await persisted()).toEqual(before);
    const normal = await http().get('/e-tickets').query({ pageSize: 100 }).set('Authorization', authorization('CADETE')).expect(200);
    const filtered = await http().get('/e-tickets').query({ pageSize: 100, estado: 'confirmado', cadeteId: 'other', clienteId: 'other' }).set('Authorization', authorization('CADETE')).expect(200);
    expect(filtered.body).toEqual(normal.body);
    expect(filtered.body.data.every((t: { estado: string }) => t.estado === 'pendiente')).toBe(true);
    const confirmed = await http().post(`/e-tickets/${id}/confirm`).set('Authorization', authorization('CADETE')).expect(201);
    expect(Object.keys(confirmed.body).sort()).toEqual(cadeteKeys);
    expect(confirmed.body.estado).toBe('confirmado');
    expect((await db().eticket.findUniqueOrThrow({ where: { id } })).estado).toBe('confirmado');
    const next = await http().get('/e-tickets').query({ pageSize: 100, estado: 'confirmado' }).set('Authorization', authorization('CADETE')).expect(200);
    expect(next.body.data.some((t: { id: string }) => t.id === id)).toBe(false);
  });

  it('orden máximo int32, empate rechazado, cliente ajeno y operación única sin writes', async () => {
    const id = await create([deposit(1), deposit(2147483647, cuentaB)]);
    const [a, b] = await rows(id);
    await put(id, { tramos: [input(a, { orden: 2147483647 }), input(b, { orden: 1 })] });
    expect((await rows(id)).map((t) => t.id)).toEqual([b.id, a.id]);
    await rejectPut(id, { tramos: [input(a), input(b, { orden: a.orden })] });
    await rejectPut(id, { clienteId: otroClienteId, instrucciones: 'NO' });
    await rejectPost({ clienteId: 'no-such-client', tramos: [deposit()] });
    await rejectPost({ clienteId, operationId: 'no-such-operation', tramos: [deposit()] });
    await db().eticket.updateMany({ where: { creadoPor: adminId, operationId }, data: { operationId: null } });
    await put(id, { operationId });
    await rejectPost({ clienteId, operationId, tramos: [deposit()] });
    const other = await create();
    await rejectPut(other, { operationId, instrucciones: 'NO' });
    await rejectPut(id, { estado: 'confirmado' });
  });
});
