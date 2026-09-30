import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';
import { cleanDatabase, createTestUser } from '../utils/db';
import { RolUsuario } from '@prisma/client';

/**
 * Tests de integración end-to-end: levantan la app Nest real (AppModule)
 * contra la DB de test y ejercitan login + uso del JWT en endpoints
 * protegidos por JwtAuthGuard / RolesGuard.
 */
describe('Auth E2E', () => {
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

  describe('POST /auth/register', () => {
    // El alta de usuarios es una operación privilegiada: sólo un ADMIN
    // autenticado puede crear cuentas. Sin esta restricción, cualquiera con la
    // URL pública podía crearse un usuario con roles arbitrarios (incluido
    // ADMIN) enviándolos en el body — escalada de privilegios.
    async function adminToken(): Promise<string> {
      const admin = await createTestUser({
        username: 'admin.register',
        roles: [RolUsuario.ADMIN],
      });
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: admin.username, password: admin.password })
        .expect(200);
      return res.body.access_token as string;
    }

    it('rechaza el alta sin token (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'anonimo', password: 'Passw0rd!', nombre: 'Anonimo' })
        .expect(401);
    });

    it('rechaza el alta con token de rol no-ADMIN (403)', async () => {
      const cadete = await createTestUser({
        username: 'cadete.register',
        roles: [RolUsuario.CADETE],
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: cadete.username, password: cadete.password })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .send({ username: 'colado', password: 'Passw0rd!', nombre: 'Colado' })
        .expect(403);
    });

    it('un ADMIN crea un usuario nuevo y recibe user sin passwordHash', async () => {
      const token = await adminToken();

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'nuevo.usuario', password: 'Passw0rd!', nombre: 'Nuevo Usuario' })
        .expect(201);

      expect(res.body.user.username).toBe('nuevo.usuario');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      // Rol por defecto: CADETE (el menos privilegiado)
      expect(res.body.user.roles).toEqual([RolUsuario.CADETE]);
    });

    it('rechaza el registro con username duplicado (409)', async () => {
      const token = await adminToken();
      await createTestUser({ username: 'repetido' });

      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'repetido', password: 'Passw0rd!', nombre: 'Otro' })
        .expect(409);
    });

    it('rechaza el registro con body inválido (400, DTO class-validator)', async () => {
      const token = await adminToken();

      await request(app.getHttpServer())
        .post('/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: '', password: '123', nombre: '' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('login exitoso retorna access_token y datos de usuario', async () => {
      const seeded = await createTestUser({ username: 'jdoe', password: 'Passw0rd!' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: seeded.username, password: seeded.password })
        .expect(200);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.user.id).toBe(seeded.id);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('login fallido con password incorrecta retorna 401', async () => {
      const seeded = await createTestUser({ username: 'jdoe2', password: 'Passw0rd!' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: seeded.username, password: 'wrong-password' })
        .expect(401);
    });

    it('login fallido con usuario inexistente retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'ghost', password: 'whatever' })
        .expect(401);
    });
  });

  describe('Rutas protegidas por JwtAuthGuard', () => {
    it('GET /auth/me sin token retorna 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('GET /auth/me con token inválido retorna 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('GET /auth/me con token válido retorna el usuario autenticado', async () => {
      const seeded = await createTestUser({ username: 'protegido', password: 'Passw0rd!' });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: seeded.username, password: seeded.password })
        .expect(200);

      const token = loginRes.body.access_token;

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meRes.body.id).toBe(seeded.id);
      expect(meRes.body.username).toBe(seeded.username);
    });
  });

  describe('Rutas protegidas por RolesGuard (ADMIN vs CADETE)', () => {
    it('un CADETE recibe 403 al intentar crear un cliente (requiere ADMIN)', async () => {
      const cadete = await createTestUser({
        username: 'cadete1',
        password: 'Passw0rd!',
        roles: [RolUsuario.CADETE],
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: cadete.username, password: cadete.password })
        .expect(200);

      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`)
        .send({ nombre: 'Cliente Prohibido', tipo: 'Persona' })
        .expect(403);
    });

    it('un ADMIN puede crear un cliente exitosamente', async () => {
      const admin = await createTestUser({
        username: 'admin1',
        password: 'Passw0rd!',
        roles: [RolUsuario.ADMIN],
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: admin.username, password: admin.password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${loginRes.body.access_token}`)
        .send({ nombre: 'Cliente Permitido', tipo: 'Persona' })
        .expect(201);

      expect(res.body.nombre).toBe('Cliente Permitido');
    });
  });
});
