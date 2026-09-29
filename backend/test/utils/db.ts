import { PrismaClient, RolUsuario, Moneda } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Cliente Prisma dedicado a tests de integración.
 * Usa DATABASE_URL de .env.test (base de datos aislada: oficina_fusion_test).
 */
export const testPrisma = new PrismaClient();

/**
 * Limpia todas las tablas relevantes en orden seguro (FKs).
 *
 * Nota: las tablas operacion/comision/gasto/cierre tienen triggers de
 * inmutabilidad post-cierre (ver migration 20260925182700) que bloquean
 * UPDATE/DELETE sobre filas ligadas a un cierre confirmado. Para poder
 * limpiar la DB de test entre tests (incluidos los que confirman cierres),
 * desactivamos temporalmente los triggers de la sesión con
 * `session_replication_role = replica` dentro de la misma transacción.
 */
export async function cleanDatabase(): Promise<void> {
  await testPrisma.$transaction([
    testPrisma.$executeRawUnsafe('SET session_replication_role = replica'),
    testPrisma.eticket.deleteMany(),
    testPrisma.clienteSaldoMovimiento.deleteMany(),
    testPrisma.comision.deleteMany(),
    testPrisma.gasto.deleteMany(),
    testPrisma.operacion.deleteMany(),
    testPrisma.cierre.deleteMany(),
    testPrisma.cuentaCliente.deleteMany(),
    testPrisma.clienteDireccion.deleteMany(),
    testPrisma.clienteTelefono.deleteMany(),
    testPrisma.cliente.deleteMany(),
    testPrisma.par.deleteMany(),
    testPrisma.loginEvent.deleteMany(),
    testPrisma.sesion.deleteMany(),
    testPrisma.usuario.deleteMany(),
    testPrisma.$executeRawUnsafe('SET session_replication_role = origin'),
  ]);
}

export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}

export interface SeededUser {
  id: string;
  username: string;
  password: string;
  roles: RolUsuario[];
}

/** Crea un usuario de prueba con password hasheado. */
export async function createTestUser(opts: {
  username: string;
  password?: string;
  nombre?: string;
  roles?: RolUsuario[];
}): Promise<SeededUser> {
  const password = opts.password ?? 'Passw0rd!';
  const passwordHash = await bcrypt.hash(password, 10);
  const roles = opts.roles ?? [RolUsuario.ADMIN];

  const user = await testPrisma.usuario.create({
    data: {
      username: opts.username,
      passwordHash,
      nombre: opts.nombre ?? opts.username,
      roles,
      activo: true,
    },
  });

  return { id: user.id, username: user.username, password, roles };
}

/** Crea un par de cotización mínimo para operaciones de prueba. */
export async function createTestPar(overrides: Partial<{
  par: string;
  base: Moneda;
  quote: Moneda;
  nombre: string;
  compra: string;
  venta: string;
  decimals: number;
}> = {}) {
  return testPrisma.par.create({
    data: {
      par: overrides.par ?? 'USD/ARS',
      base: overrides.base ?? 'USD',
      quote: overrides.quote ?? 'ARS',
      nombre: overrides.nombre ?? 'Dólar / Peso',
      compra: overrides.compra ?? '1000.00',
      venta: overrides.venta ?? '1010.00',
      varPct: '0',
      decimals: overrides.decimals ?? 2,
    },
  });
}

export async function createTestCliente(overrides: Partial<{
  nombre: string;
  tipo: 'Persona' | 'Empresa';
  doc: string;
}> = {}) {
  return testPrisma.cliente.create({
    data: {
      nombre: overrides.nombre ?? 'Cliente de Prueba',
      tipo: overrides.tipo ?? 'Persona',
      doc: overrides.doc ?? '00000000',
    },
  });
}
