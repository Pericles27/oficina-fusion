#!/usr/bin/env node
// D1 R1: run ONLY in a detached, sanitized snapshot of e450f7d + this runner.
// cd <snapshot>; D1_SAFE_SNAPSHOT=1 DATABASE_URL=postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_d1_<new_name> node test/d1-par-usd-pivote-test.mjs
// Create the database separately with createdb (never reuse/drop an existing DB).
// No package manager, client generation, shell, dotenv, or inherited child env.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const psqlBin = '/opt/homebrew/Cellar/postgresql@18/18.6/bin/psql';
// Immutable source hashes from e450f7d0d4567c1b02ceda5a3fa67406cf12622b.
const sources = {
  'prisma/migrations/20260925182658_init/migration.sql': 'f166db2129cdea73c89f9690bdf7b154751eaf5612f4c23344afa212d34728b6',
  'prisma/migrations/20260925182700_immutability_and_checks/migration.sql': '2a826301606ad9354d66fe06cfbf04f3a01c563cdd5924b79d327a2935c9fab6',
  'prisma/migrations/20260925191433_fix_inmutability_reopen/migration.sql': 'd35208b377605c189119b95015104e9a76dc5bdf363fe5a7a4ad8bc73a57982f',
  'prisma/migrations/20260929233340_add_operador_role/migration.sql': '1d23dc45566b74d02d3ed8acc37183c79f00b13c9bd1483d726b2128f5779431',
  'prisma/migrations/20261018020000_D1_par_usd_pivote/migration.sql': '0b785b7a4229461d9244d956c20e5dfa77a3da42d70d46299041bdb7720c60fc',
  'prisma/migrations/migration_lock.toml': '99836963713b4f5b269ad49af0ed3d7b0b2e336115c2f92dc9ac683d139d0900',
  'prisma/schema.prisma': '86a4e25e9385d3d068781227e148bf29686e6768e132418a71d18bb05ee4e255',
  'src/modules/operations/aggregators/par.ts': '38d93915b4efd5afee5b02f8b51e8cf650418748155be869157f77ba4e123638',
};

function preflight() {
  assert.equal(process.env.D1_SAFE_SNAPSHOT, '1', 'D1_SAFE_SNAPSHOT=1 required; no subprocess started');
  // Exact raw syntax: no password, query, fragment, encoding, alternate host or port.
  assert.match(process.env.DATABASE_URL ?? '', /^postgresql:\/\/auditor_synthetic@127\.0\.0\.1:56437\/redisenio_d1_[a-z0-9_]+$/, 'Rejected DATABASE_URL; no subprocess started');
  const dbName = process.env.DATABASE_URL.split('/').at(-1);
  assert.ok(dbName.length <= 63, 'Database name exceeds PostgreSQL limit');
  assert.equal(realpathSync(process.cwd()), root, 'cwd must be the detached snapshot root');
  // Inspect names only, never open env/config files. Prisma's root .env is
  // selected via an ancestor package.json: reject every such package/config.
  // Unrelated ancestor .env files are not candidates without package.json.
  // The recursive allowlist below excludes ALL env/config files in snapshot.
  for (let dir = root; ; dir = dirname(dir)) {
    const names = readdirSync(dir);
    assert.ok(!names.some((name) => name === '.git' || name === 'package.json' || /^prisma\.config\./.test(name)), 'Unsafe snapshot/ancestor configuration; no subprocess started');
    if (dirname(dir) === dir) break;
  }
  const allowed = new Set([...Object.keys(sources), 'test/d1-par-usd-pivote-test.mjs']);
  const found = new Set();
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(root, path);
      const stat = lstatSync(path);
      if (rel === 'node_modules') {
        assert.ok(stat.isSymbolicLink(), 'node_modules must link installed dependencies');
      } else if (stat.isDirectory()) {
        assert.ok([...allowed].some((file) => file.startsWith(`${rel}/`)), 'Unexpected snapshot directory');
        walk(path);
      } else {
        assert.ok(stat.isFile() && allowed.has(rel), 'Unexpected file or symlink in snapshot');
        found.add(rel);
      }
    }
  }
  walk(root);
  for (const [file, hash] of Object.entries(sources)) {
    assert.ok(found.has(file), `Missing source ${file}`);
    assert.equal(createHash('sha256').update(readFileSync(join(root, file))).digest('hex'), hash, `Source differs from e450f7d: ${file}`);
  }
  assert.ok(lstatSync(join(root, 'node_modules')).isSymbolicLink());
  assert.ok(lstatSync(resolve(root, 'node_modules/prisma/build/index.js')).isFile());
  return dbName;
}

function main() {
  const dbName = preflight(); // All validation precedes subprocesses/network.
  console.log('PREFLIGHT OK: detached snapshot, exact baseline4+D1 hashes, no env/config files');
  const runtime = mkdtempSync(join(root, '.d1-runtime-'));
  mkdirSync(join(runtime, 'home'));
  mkdirSync(join(runtime, 'tmp'));
  const env = {
    PATH: `${dirname(process.execPath)}:/opt/homebrew/Cellar/postgresql@18/18.6/bin:/usr/bin:/bin`,
    HOME: join(runtime, 'home'),
    TMPDIR: join(runtime, 'tmp'),
    DATABASE_URL: process.env.DATABASE_URL,
    D1_SAFE_SNAPSHOT: '1',
  };
  function run(bin, args, input, expectedExit = 0) {
    console.log(`COMMAND ${JSON.stringify([bin, ...args])}\nCWD ${root}`);
    if (input) console.log(`STDIN\n${input}`);
    let stdout = '', stderr = '', status = 0;
    try {
      stdout = execFileSync(bin, args, { cwd: root, env, input, encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      if (!Number.isInteger(err.status)) throw err;
      ({ stdout, stderr, status } = err);
    }
    console.log(`STDOUT\n${stdout}\nSTDERR\n${stderr}\nEXIT ${status}`);
    assert.equal(status, expectedExit, 'Unexpected subprocess exit');
    return { stdout, stderr };
  }
  function sql(input, expectedExit = 0) {
    return run(psqlBin, ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-p', '56437', '-U', 'auditor_synthetic', '-d', dbName, '-t', '-A', '-f', '-'], input, expectedExit);
  }
  // A fresh DB is mandatory: fail before migrations/writes if any user relation exists.
  assert.equal(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND c.relkind IN ('r','p','v','m','S','f');").stdout.trim(), '0', 'Database is not fresh');
  run(process.execPath, [join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(root, 'prisma/schema.prisma')]);
  for (const [base, quote, valid] of [['USD', 'ARS', true], ['GBP', 'USD', true], ['EUR', 'ARS', false], ['GBP', 'EUR', false]]) {
    const result = sql(`INSERT INTO "par" (par, base, quote, nombre, compra, venta, "varPct", decimals) VALUES ('${base}/${quote}', '${base}', '${quote}', 'D1 synthetic fixture', 1, 2, 0, 2);`, valid ? 0 : 3);
    if (!valid) {
      assert.match(result.stderr, /ERROR:\s+23514:/);
      // This synthetic cluster emits verbose field labels in Spanish; the
      // SQLSTATE and exact constraint identifier remain mandatory.
      assert.match(result.stderr, /(?:^|\n)(?:CONSTRAINT NAME|NOMBRE DE RESTRICCIÓN):\s+par_usd_pivote(?:\r?\n|$)/);
    }
    console.log(`PASS ${base}/${quote} ${valid ? 'accepted' : 'rejected: 23514 / par_usd_pivote'}`);
  }
  const constraint = sql("SELECT n.nspname, c.conname, c.contype, c.convalidated, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.conrelid='public.par'::regclass AND c.conname='par_usd_pivote';").stdout.trim();
  assert.equal(constraint, 'public|par_usd_pivote|c|t|CHECK (((base = \'USD\'::"Moneda") OR (quote = \'USD\'::"Moneda")))');
  assert.equal(sql('SELECT string_agg(par, \',\' ORDER BY par) FROM "par";').stdout.trim(), 'GBP/USD,USD/ARS');
  const migrations = sql('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name;').stdout.trim().split('\n');
  assert.deepEqual(migrations, Object.keys(sources).filter((file) => file.endsWith('/migration.sql')).map((file) => file.split('/')[2]));
  console.log('PASS pg_constraint exact/validated; only synthetic valid pairs; baseline4+D1 only');
}

try {
  main();
} catch (err) {
  console.error(`D1 FAIL: ${err.message}`);
  process.exitCode = 1;
}
