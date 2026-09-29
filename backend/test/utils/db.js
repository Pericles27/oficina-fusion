"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPrisma = void 0;
exports.cleanDatabase = cleanDatabase;
exports.disconnectTestDb = disconnectTestDb;
exports.createTestUser = createTestUser;
exports.createTestPar = createTestPar;
exports.createTestCliente = createTestCliente;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
/**
 * Cliente Prisma dedicado a tests de integración.
 * Usa DATABASE_URL de .env.test (base de datos aislada: oficina_fusion_test).
 */
exports.testPrisma = new client_1.PrismaClient();
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
async function cleanDatabase() {
    await exports.testPrisma.$transaction([
        exports.testPrisma.$executeRawUnsafe('SET session_replication_role = replica'),
        exports.testPrisma.eticket.deleteMany(),
        exports.testPrisma.clienteSaldoMovimiento.deleteMany(),
        exports.testPrisma.comision.deleteMany(),
        exports.testPrisma.gasto.deleteMany(),
        exports.testPrisma.operacion.deleteMany(),
        exports.testPrisma.cierre.deleteMany(),
        exports.testPrisma.cuentaCliente.deleteMany(),
        exports.testPrisma.clienteDireccion.deleteMany(),
        exports.testPrisma.clienteTelefono.deleteMany(),
        exports.testPrisma.cliente.deleteMany(),
        exports.testPrisma.par.deleteMany(),
        exports.testPrisma.loginEvent.deleteMany(),
        exports.testPrisma.sesion.deleteMany(),
        exports.testPrisma.usuario.deleteMany(),
        exports.testPrisma.$executeRawUnsafe('SET session_replication_role = origin'),
    ]);
}
async function disconnectTestDb() {
    await exports.testPrisma.$disconnect();
}
/** Crea un usuario de prueba con password hasheado. */
async function createTestUser(opts) {
    const password = opts.password ?? 'Passw0rd!';
    const passwordHash = await bcrypt.hash(password, 10);
    const roles = opts.roles ?? [client_1.RolUsuario.ADMIN];
    const user = await exports.testPrisma.usuario.create({
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
async function createTestPar(overrides = {}) {
    return exports.testPrisma.par.create({
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
async function createTestCliente(overrides = {}) {
    return exports.testPrisma.cliente.create({
        data: {
            nombre: overrides.nombre ?? 'Cliente de Prueba',
            tipo: overrides.tipo ?? 'Persona',
            doc: overrides.doc ?? '00000000',
        },
    });
}
//# sourceMappingURL=db.js.map