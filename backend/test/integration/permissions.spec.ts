import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser, createTestPar, createTestCliente } from '../utils/db';
import { RolUsuario } from '@prisma/client';

/**
 * F2 §2A — matriz de permisos por rol.
 *
 * El agujero que se cierra acá: antes de esta fase, `operations`, `e-tickets`
 * y `closing` colgaban de `@UseGuards(JwtAuthGuard)` (o de un `@Roles(ADMIN)`
 * a nivel de clase que el propio `RolesGuard` ignoraba — ver
 * `roles.guard.spec.ts`), así que un CADETE autenticado podía crear
 * operaciones y ver el cierre diario. Estos tests ejercitan la matriz real
 * contra la app completa (JwtAuthGuard + RolesGuard reales, no mocks).
 */
describe('F2 — matriz de permisos por rol', () => {
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

  describe('POST /operations — el agujero original', () => {
    it('un CADETE recibe 403 al intentar crear una operación', async () => {
      await createTestPar();
      const token = await loginAs('cadete.ops', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .post('/operations')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
        .expect(403);
    });

    it('un CADETE recibe 403 al listar operaciones (GET)', async () => {
      const token = await loginAs('cadete.ops.get', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .get('/operations')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('un OPERADOR puede crear una operación (201)', async () => {
      await createTestPar();
      const token = await loginAs('operador.ops', [RolUsuario.OPERADOR]);

      const res = await request(app.getHttpServer())
        .post('/operations')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
        .expect(201);

      expect(res.body.status).toBe('pendiente');
    });

    it('un ADMIN puede crear una operación (201)', async () => {
      await createTestPar();
      const token = await loginAs('admin.ops', [RolUsuario.ADMIN]);

      await request(app.getHttpServer())
        .post('/operations')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'C', parId: 'USD/ARS', monto: '100', cobertura: 'efectivo' })
        .expect(201);
    });
  });

  describe('POST /e-tickets', () => {
    it('un CADETE recibe 403 al crear un e-ticket', async () => {
      const cliente = await createTestCliente();
      const token = await loginAs('cadete.et', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .post('/e-tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: cliente.id, metodoEntrega: 'en_mano' })
        .expect(403);
    });

    it('un OPERADOR puede crear un e-ticket (201)', async () => {
      const cliente = await createTestCliente();
      const token = await loginAs('operador.et', [RolUsuario.OPERADOR]);

      await request(app.getHttpServer())
        .post('/e-tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({ clienteId: cliente.id, metodoEntrega: 'en_mano' })
        .expect(201);
    });
  });

  describe('POST /closing — separación operador/admin (default 3, §6)', () => {
    async function closingBody() {
      return {
        fecha: new Date().toISOString(),
        tcCierre: '1000',
        saldoInicialUsd: '0',
        cajaContadaUsd: '0',
      };
    }

    it('un CADETE recibe 403 al crear el cierre', async () => {
      const token = await loginAs('cadete.closing', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .post('/closing')
        .set('Authorization', `Bearer ${token}`)
        .send(await closingBody())
        .expect(403);
    });

    it('un OPERADOR puede crear el cierre en borrador (201) pero no confirmarlo ni reabrirlo (403)', async () => {
      const token = await loginAs('operador.closing', [RolUsuario.OPERADOR]);

      const res = await request(app.getHttpServer())
        .post('/closing')
        .set('Authorization', `Bearer ${token}`)
        .send(await closingBody())
        .expect(201);

      expect(res.body.estado).toBe('borrador');
      const cierreId = res.body.id;

      await request(app.getHttpServer())
        .post(`/closing/${cierreId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/closing/${cierreId}/reopen`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('un OPERADOR puede leer el cierre (GET), un CADETE no', async () => {
      const opToken = await loginAs('operador.closing.get', [RolUsuario.OPERADOR]);
      const cadeteToken = await loginAs('cadete.closing.get', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .get('/closing')
        .set('Authorization', `Bearer ${opToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/closing')
        .set('Authorization', `Bearer ${cadeteToken}`)
        .expect(403);
    });

    it('un ADMIN puede confirmar un cierre creado por un OPERADOR (201)', async () => {
      const opToken = await loginAs('operador.closing.ok', [RolUsuario.OPERADOR]);
      const adminToken = await loginAs('admin.closing.ok', [RolUsuario.ADMIN]);

      const res = await request(app.getHttpServer())
        .post('/closing')
        .set('Authorization', `Bearer ${opToken}`)
        .send(await closingBody())
        .expect(201);

      const confirmRes = await request(app.getHttpServer())
        .post(`/closing/${res.body.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(confirmRes.body.estado).toBe('confirmado');
    });
  });

  describe('PATCH /users/:id y POST /users/:id/reset-password — sólo ADMIN', () => {
    it('un OPERADOR recibe 403 al intentar desactivar un usuario', async () => {
      const target = await createTestUser({ username: 'target.user' });
      const token = await loginAs('operador.users', [RolUsuario.OPERADOR]);

      await request(app.getHttpServer())
        .patch(`/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false })
        .expect(403);
    });

    it('un ADMIN puede desactivar un usuario (200) y reflejarse en login (401)', async () => {
      const target = await createTestUser({ username: 'target.user2' });
      const adminToken = await loginAs('admin.users', [RolUsuario.ADMIN]);

      await request(app.getHttpServer())
        .patch(`/users/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: target.username, password: target.password })
        .expect(401);
    });

    it('un ADMIN puede resetear la password de un usuario y fuerza primerLogin', async () => {
      const target = await createTestUser({ username: 'target.user3' });
      const adminToken = await loginAs('admin.users2', [RolUsuario.ADMIN]);

      const res = await request(app.getHttpServer())
        .post(`/users/${target.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.temporaryPassword).toEqual(expect.any(String));

      // La password vieja ya no sirve
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: target.username, password: target.password })
        .expect(401);

      // La temporal sí, y el usuario queda con primerLogin=true
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: target.username, password: res.body.temporaryPassword })
        .expect(200);

      expect(loginRes.body.user.primerLogin).toBe(true);
    });

    it('un CADETE recibe 403 al intentar listar usuarios', async () => {
      const token = await loginAs('cadete.users', [RolUsuario.CADETE]);

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('F4: ciclo completo — crear (register) -> cambiar rol (PATCH) -> desactivar -> 401 al reintentar', async () => {
      const adminToken = await loginAs('admin.ciclo', [RolUsuario.ADMIN]);

      // 1. Crear usuario (POST /auth/register, CADETE inicial)
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'ciclo.usuario',
          password: 'password123',
          nombre: 'Usuario Ciclo',
          roles: [RolUsuario.CADETE],
        })
        .expect(201);

      const userId = registerRes.body.id ?? registerRes.body.user?.id;
      expect(userId).toEqual(expect.any(String));

      // El usuario recién creado puede loguearse con CADETE
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'ciclo.usuario', password: 'password123' })
        .expect(200);

      // 2. Cambiar rol a OPERADOR (PATCH /users/:id)
      const patchRes = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: [RolUsuario.OPERADOR] })
        .expect(200);

      expect(patchRes.body.roles).toEqual([RolUsuario.OPERADOR]);

      // El rol nuevo se refleja en el próximo login (JWT firmado de nuevo)
      const loginTrasRol = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'ciclo.usuario', password: 'password123' })
        .expect(200);
      expect(loginTrasRol.body.user.roles).toEqual([RolUsuario.OPERADOR]);

      // 3. Desactivar (PATCH /users/:id {activo: false})
      await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false })
        .expect(200);

      // 4. 401 al reintentar login
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'ciclo.usuario', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /auth/me devuelve primerLogin', () => {
    it('incluye el campo primerLogin en la respuesta', async () => {
      const token = await loginAs('me.primerlogin', [RolUsuario.ADMIN]);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('primerLogin');
      expect(typeof res.body.primerLogin).toBe('boolean');
    });
  });
});
