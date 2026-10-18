#!/usr/bin/env python3
"""B1 reproducible: immutable baseline + explicit B1 overlay, no env/test setup.
Usage: python3 scripts/verify-b1.py /absolute/path/in/carlos-gpt/cache/scratch/new-run
Uses installed binaries only. DB is fixed to the Auditor's exclusive synthetic DB.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPO = Path(__file__).resolve().parents[1]
BASE = 'cc9122b49dc65823342c7272c215f82fc14ff24b'
SCRATCH = Path('/Users/nicolas/.hermes/profiles/carlos-gpt/cache/scratch')
DEST = Path(sys.argv[1]).resolve()
assert DEST.is_relative_to(SCRATCH) and DEST != SCRATCH, 'Use a new directory in the authorized scratch'
DEST.mkdir(parents=True, exist_ok=False)
(DEST / 'tmp').mkdir()
OVERLAY = [
    'frontend/lib/caja-store.tsx',
    'frontend/components/OperationsBoard.tsx',
    'frontend/test/b1-runtime.mjs',
    'backend/test/integration/b1-cliente-id.spec.ts',
    'scripts/verify-b1.py',
]
BACKEND = {'backend/package.json', 'backend/tsconfig.json', 'backend/prisma/schema.prisma',
           'backend/test/integration/test-app.ts'}
# No docs, .env, .npmrc, seed, dumps, test/setup.ts or other work in progress.
def allowed(name):
    path = Path(name)
    if any(part.startswith('.env') or part == '.npmrc' for part in path.parts):
        return False
    if name in BACKEND:
        return True
    if name.startswith('backend/src/'):
        return path.suffix == '.ts' and not name.endswith('.spec.ts')
    if name.startswith('frontend/'):
        return (path.suffix in {'.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.svg', '.ico', '.png'}
                and 'tsbuildinfo' not in name and '/test/' not in name)
    return False

manifest = []
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE], cwd=REPO, text=True).splitlines()
for name in sorted(set(filter(allowed, names)) | set(OVERLAY)):
    data = ((REPO / name).read_bytes() if name in OVERLAY else
            subprocess.check_output(['git', 'show', f'{BASE}:{name}'], cwd=REPO))
    target = DEST / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    manifest.append({'path': name, 'source': 'B1 overlay' if name in OVERLAY else BASE,
                     'sha256': hashlib.sha256(data).hexdigest()})
manifest_bytes = json.dumps(manifest, indent=2).encode()
(DEST / 'snapshot-manifest.json').write_bytes(manifest_bytes)
(DEST / 'snapshot-manifest.sha256').write_text(hashlib.sha256(manifest_bytes).hexdigest() + '\n')
# Existing dependencies are read through symlinks. Never generate shared Prisma.
for workspace in ['backend', 'frontend']:
    (DEST / workspace / 'node_modules').symlink_to(REPO / workspace / 'node_modules', target_is_directory=True)

env = {key: os.environ[key] for key in ['PATH', 'HOME'] if key in os.environ}
env.update({
    'TMPDIR': str(DEST / 'tmp'), 'CI': '1', 'NEXT_TELEMETRY_DISABLED': '1',
    'NEXT_PUBLIC_API_URL': 'http://b1.invalid', 'B1_SAFE_SNAPSHOT': '1',
    'DATABASE_URL': 'postgresql://auditor_synthetic@127.0.0.1:56437/redisenio_b1',
    'JWT_SECRET': 'b1-synthetic-only-not-for-deployment-20261017',
    'PRISMA_GENERATE_SKIP_AUTOINSTALL': 'true', 'PRISMA_HIDE_UPDATE_MESSAGE': 'true',
    'CHECKPOINT_DISABLE': '1',
})
records = []
def run(label, command, workspace):
    cwd = DEST / workspace
    print(f'\n$ {command!r}\ncwd={cwd}', flush=True)
    result = subprocess.run(command, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (DEST / f'{label}.log').write_text(result.stdout)
    print(result.stdout, end='', flush=True)
    print(f'EXIT {result.returncode}', flush=True)
    records.append({'label': label, 'cwd': str(cwd), 'command': command, 'exit': result.returncode})
    (DEST / 'commands.json').write_text(json.dumps(records, indent=2))
    if result.returncode:
        raise SystemExit(result.returncode)

schema = DEST / 'backend/prisma/schema.prisma'
schema.write_text(schema.read_text().replace('provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  output = "../generated/b1"', 1))
run('prisma-private-generate', ['node', 'node_modules/prisma/build/index.js', 'generate', '--schema', 'prisma/schema.prisma'], 'backend')
(DEST / 'backend/vitest.b1.config.mts').write_text('''import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { alias: {
    '@prisma/client': local('./generated/b1/index.js'),
    '@common': local('./src/common'), '@modules': local('./src/modules'),
  } },
  test: { include: ['test/integration/b1-cliente-id.spec.ts'], setupFiles: [],
    environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 },
});
''')
run('nest-post-select', ['node', 'node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.b1.config.mts'], 'backend')
# Exact package-script commands via installed binaries, no package manager:
# this machine's pnpm attempts automatic installs even for `run`.
run('frontend-lint', ['node', 'node_modules/next/dist/bin/next', 'lint'], 'frontend')
run('frontend-build', ['node', 'node_modules/next/dist/bin/next', 'build'], 'frontend')
run('frontend-post-build', ['node', 'scripts/post-build-inject.js'], 'frontend')
# Test-only route is created AFTER the production build; never ships in the repo.
route = DEST / 'frontend/app/b1-harness/page.tsx'
route.parent.mkdir(parents=True)
route.write_text('''"use client";
import { useEffect } from 'react';
import { CajaProvider, useCaja } from '@/lib/caja-store';
import { OperationsBoard } from '@/components/OperationsBoard';
function Bridge() {
  const caja = useCaja();
  useEffect(() => { (window as unknown as { __b1Caja: typeof caja }).__b1Caja = caja; }, [caja]);
  return <OperationsBoard />;
}
export default function Harness() { return <CajaProvider><Bridge /></CajaProvider>; }
''')
run('frontend-browser-runtime', ['node', 'test/b1-runtime.mjs'], 'frontend')
# A1 guard, source of changed production TSX only. Empty matches is success.
pattern = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(')
matches = []
for name in OVERLAY[:2]:
    for line, text in enumerate((DEST / name).read_text().splitlines(), 1):
        if pattern.search(text):
            matches.append(f'{name}:{line}:{text}')
(DEST / 'a1-color-grep.log').write_text('\n'.join(matches))
print('A1 hardcoded color grep:', matches)
assert not matches
print('Snapshot manifest SHA256:', hashlib.sha256(manifest_bytes).hexdigest())
print('PASS B1 verification; evidence:', DEST)
