import { PrismaClient, RolUsuario, Moneda } from '@prisma/client';
/**
 * Cliente Prisma dedicado a tests de integración.
 * Usa DATABASE_URL de .env.test (base de datos aislada: oficina_fusion_test).
 */
export declare const testPrisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
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
export declare function cleanDatabase(): Promise<void>;
export declare function disconnectTestDb(): Promise<void>;
export interface SeededUser {
    id: string;
    username: string;
    password: string;
    roles: RolUsuario[];
}
/** Crea un usuario de prueba con password hasheado. */
export declare function createTestUser(opts: {
    username: string;
    password?: string;
    nombre?: string;
    roles?: RolUsuario[];
}): Promise<SeededUser>;
/** Crea un par de cotización mínimo para operaciones de prueba. */
export declare function createTestPar(overrides?: Partial<{
    par: string;
    base: Moneda;
    quote: Moneda;
    nombre: string;
    compra: string;
    venta: string;
    decimals: number;
}>): Promise<{
    nombre: string;
    par: string;
    base: import("@prisma/client").$Enums.Moneda;
    quote: import("@prisma/client").$Enums.Moneda;
    compra: import("@prisma/client/runtime/library").Decimal;
    venta: import("@prisma/client/runtime/library").Decimal;
    varPct: import("@prisma/client/runtime/library").Decimal;
    decimals: number;
}>;
export declare function createTestCliente(overrides?: Partial<{
    nombre: string;
    tipo: 'Persona' | 'Empresa';
    doc: string;
}>): Promise<{
    id: string;
    nombre: string;
    activo: boolean;
    tipo: import("@prisma/client").$Enums.ClienteTipo;
    notas: string | null;
    createdAt: Date;
    updatedAt: Date;
    apellido: string | null;
    alias: string | null;
    doc: string | null;
    saldoUsd: import("@prisma/client/runtime/library").Decimal;
    custodia: string | null;
    puntosHabituales: import("@prisma/client/runtime/library").Decimal | null;
}>;
//# sourceMappingURL=db.d.ts.map