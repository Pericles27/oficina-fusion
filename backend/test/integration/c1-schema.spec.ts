/** C1: real PostgreSQL checks; run only in the sanitized C1 harness.
 * Each psql session owns its fixtures and rolls them back. No app setup/env files.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const database = 'postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_c1_gpt';
const psql = '/opt/homebrew/Cellar/postgresql@18/18.6/bin/psql';
const cbu = '1234567890123456789012';
const fixtures = `
INSERT INTO usuario (id, username, "passwordHash", nombre, roles, "modificadoEn")
VALUES ('c1-user', 'c1-synthetic', 'not-a-login', 'Synthetic C1', '{ADMIN}', now());
INSERT INTO cliente (id, nombre, tipo, "updatedAt") VALUES ('c1-client', 'Synthetic C1', 'Persona', now());
INSERT INTO cuenta_cliente (id, "clienteId", banco, tipo, numero, cbu)
VALUES ('c1-account', 'c1-client', 'Synthetic Bank', 'alias', 'synthetic-original', '${cbu}');
INSERT INTO eticket (id, numero, codigo, "clienteId", "metodoEntrega", "creadoPor", "updatedAt")
VALUES ('c1-ticket', 901, 'C1-SYNTHETIC', 'c1-client', 'en_mano', 'c1-user', now());
`;

// Only fixed, synthetic SQL literals from this file are interpolated.
function tramo(overrides: Record<string, string> = {}): string {
  const fields = {
    id: "'c1-tramo'", eticketId: "'c1-ticket'", orden: '1',
    sentido: "'ENTREGA'", canal: "'EFECTIVO'", moneda: "'ARS'", monto: '100',
    ...overrides,
  };
  return `INSERT INTO eticket_tramo (${Object.keys(fields).map((key) => `"${key}"`).join(',')})
    VALUES (${Object.values(fields).join(',')});`;
}

function assertSql(condition: string): string {
  return `DO $assert$ BEGIN IF NOT (${condition}) THEN
    RAISE EXCEPTION 'C1 assertion failed: %', ${"'" + condition.replaceAll("'", "''") + "'"};
    END IF; END $assert$;`;
}

// An unexpected FK, uniqueness error, missing column or successful insert fails.
// PostgreSQL's exception block is a real subtransaction, not a Prisma nested tx.
function violation(statement: string, state: string, constraint: string, column = ''): string {
  return `DO $check$ DECLARE got_state text; got_constraint text; got_column text;
  BEGIN
    BEGIN
      ${statement}
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS got_state = RETURNED_SQLSTATE,
        got_constraint = CONSTRAINT_NAME, got_column = COLUMN_NAME;
    END;
    IF got_state IS DISTINCT FROM '${state}' OR got_constraint IS DISTINCT FROM '${constraint}'
       OR got_column IS DISTINCT FROM '${column}' THEN
      RAISE EXCEPTION 'Expected ${state}/${constraint}/${column}, got %/%/%',
        got_state, got_constraint, got_column;
    END IF;
    RAISE NOTICE 'C1 verified SQLSTATE=% constraint=% column=%', got_state, got_constraint, got_column;
  END $check$;`;
}

function sql(body: string): void {
  // Fail closed BEFORE spawning psql. Never fall back to a repo URL or database.
  expect(process.env.C1_DATABASE_URL).toBe(database);
  const output = execFileSync(psql, ['-X', '--no-password', '--dbname', database,
    '--set', 'ON_ERROR_STOP=1', '--file', '-'], {
    input: `BEGIN;\n${fixtures}\n${body}\nROLLBACK;\nSELECT 'C1_OK';\n`,
    encoding: 'utf8', timeout: 15000,
    env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', PGCONNECT_TIMEOUT: '5' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  expect(output).toContain('C1_OK');
}

const efectivoFields: Array<[string, string]> = [
  ['cuentaDestinoId', "'c1-account'"], ['depBeneficiario', "'Synthetic'"],
  ['depCuit', "'synthetic-tax'"], ['depBanco', "'Synthetic Bank'"],
  ['depNumeroCuenta', "'synthetic-number'"], ['depCbu', `'${cbu}'`],
  ['depAlias', "'synthetic.alias'"], ['depTipoCuenta', "'CAJA_AHORRO'"],
];

describe('C1 schema on exclusive synthetic PostgreSQL', () => {
  it.each(efectivoFields)('EFECTIVO rejects %s independently', (field, value) => {
    sql(violation(tramo({ [field]: value }), '23514', 'eticket_tramo_efectivo_no_deps'));
  });

  it('DEPOSITO/ENTREGA requires an identifier, even with a valid account FK', () => {
    sql(violation(tramo({ canal: "'DEPOSITO'", cuentaDestinoId: "'c1-account'" }),
      '23514', 'eticket_tramo_deposito_entrega_needs_identifier'));
  });

  it.each(['0', '-1'])('rejects monto %s', (monto) => {
    sql(violation(tramo({ monto }), '23514', 'eticket_tramo_monto_positive'));
  });

  it.each(['123456789012345678901', 'abcdefghijklmnopqrstuv'])('rejects invalid account/snapshot CBU %s', (bad) => {
    sql(violation(`UPDATE cuenta_cliente SET cbu = '${bad}' WHERE id = 'c1-account';`,
      '23514', 'cuenta_cliente_cbu_digits') +
      violation(tramo({ canal: "'DEPOSITO'", depCbu: `'${bad}'` }), '23514', 'eticket_tramo_dep_cbu_digits'));
  });

  it('rejects NULL movement currency with 23502 and exact column', () => {
    sql(violation(tramo({ moneda: 'NULL' }), '23502', '', 'moneda'));
  });

  it('accepts mixed tramos and each deposit identifier with valid FKs', () => {
    sql(tramo() + efectivoFields.filter(([field]) => ['depCbu', 'depNumeroCuenta', 'depAlias'].includes(field))
      .map(([field, value], index) => tramo({ id: `'c1-deposit-${index}'`, orden: String(index + 2),
        canal: "'DEPOSITO'", cuentaDestinoId: "'c1-account'", [field]: value,
        depTipoCuenta: "'CUENTA_CORRIENTE'" })).join('\n') +
      assertSql(`(SELECT count(*) = 4 FROM eticket_tramo WHERE "eticketId" = 'c1-ticket')`));
  });

  it('U3-bis: account and snapshot currency only ARS or USD', () => {
    sql(violation(`UPDATE cuenta_cliente SET "monedaCuenta" = 'EUR' WHERE id = 'c1-account';`,
      '23514', 'cuenta_cliente_moneda_ars_usd') +
      violation(tramo({ canal: "'DEPOSITO'", cuentaDestinoId: "'c1-account'", depAlias: "'synthetic.alias'",
        depMonedaCuenta: "'EUR'" }), '23514', 'eticket_tramo_dep_moneda_ars_usd') +
      `UPDATE cuenta_cliente SET "monedaCuenta" = 'USD' WHERE id = 'c1-account';` +
      assertSql(`(SELECT "monedaCuenta" = 'USD' FROM cuenta_cliente WHERE id = 'c1-account')`));
  });

  it('permits DEPOSITO/RETIRO without identifiers (U6 is not a DB rule)', () => {
    sql(tramo({ canal: "'DEPOSITO'", sentido: "'RETIRO'" }) +
      assertSql(`(SELECT count(*) = 1 FROM eticket_tramo)`));
  });

  it('enforces tramo FKs, unique order and cascade deletion', () => {
    sql(violation(tramo({ eticketId: "'c1-missing'" }), '23503', 'eticket_tramo_eticketId_fkey') +
      violation(tramo({ canal: "'DEPOSITO'", depAlias: "'synthetic.alias'", cuentaDestinoId: "'c1-missing'" }),
        '23503', 'eticket_tramo_cuentaDestinoId_fkey') + tramo() +
      violation(tramo({ id: "'c1-duplicate-order'" }), '23505', 'eticket_tramo_eticketId_orden_key') +
      `DELETE FROM eticket WHERE id = 'c1-ticket';` + assertSql('(SELECT count(*) = 0 FROM eticket_tramo)'));
  });

  it('has exact enum, nullable account additions, required Moneda and no header CHECK', () => {
    sql(assertSql(`enum_range(NULL::"TipoCuenta")::text = '{CAJA_AHORRO,CUENTA_CORRIENTE}'`) +
      assertSql(`(SELECT count(*) = 5 AND bool_and(is_nullable = 'YES') FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cuenta_cliente'
        AND column_name IN ('tipoCuenta','numeroCuenta','cbu','alias','cuitTitular'))`) +
      assertSql(`(SELECT count(*) = 1 AND bool_and(udt_name = 'Moneda' AND is_nullable = 'NO')
        FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'eticket_tramo' AND column_name = 'moneda')`) +
      // U3-bis respondida (2026-10-19): moneda de la cuenta ARS/USD, copia en el tramo.
      assertSql(`(SELECT count(*) = 2 AND bool_and(udt_name = 'Moneda') FROM information_schema.columns
        WHERE table_schema = 'public' AND ((table_name = 'cuenta_cliente' AND column_name = 'monedaCuenta')
        OR (table_name = 'eticket_tramo' AND column_name = 'depMonedaCuenta')))`) +
      assertSql(`EXISTS (SELECT FROM pg_constraint WHERE conname = 'cuenta_cliente_moneda_ars_usd' AND contype = 'c')`) +
      assertSql(`NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'eticket'::regclass AND contype = 'c')`) +
      assertSql(`(SELECT count(*) = 5 FROM pg_constraint WHERE conrelid = 'eticket_tramo'::regclass AND contype = 'c')`) +
      assertSql(`(SELECT count(*) = 1 FROM pg_constraint WHERE conrelid = 'eticket'::regclass
        AND conname = 'eticket_operationId_fkey' AND confrelid = 'operacion'::regclass AND contype = 'f')`) +
      assertSql(`EXISTS (SELECT FROM pg_index WHERE indexrelid = '"eticket_operationId_key"'::regclass AND indisunique)`) +
      assertSql(`(SELECT tipo = 'alias' AND numero = 'synthetic-original' AND "tipoCuenta" IS NULL
        AND "numeroCuenta" IS NULL AND alias IS NULL AND "cuitTitular" IS NULL FROM cuenta_cliente WHERE id = 'c1-account')`));
  });
});
