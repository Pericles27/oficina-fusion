// Run from the allowlist snapshot created by scripts/verify-b1.py.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createWriteStream, writeFileSync } from 'node:fs';
import { once } from 'node:events';

assert.equal(process.env.B1_SAFE_SNAPSHOT, '1');
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const serverLog = createWriteStream('b1-next-dev.log');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://b1.invalid', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.pipe(serverLog);
server.stderr.pipe(serverLog);
let browser;
const results = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`Next exited ${server.exitCode}`);
    try { await fetch(origin); ready = true; break; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  assert.ok(ready, 'Next server ready');
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const posts = [];
    const unexpected = [];
    const errors = [];
    let failPost = false;
    let operations = [];
    // Installed before navigation: no external request is allowed through.
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (url.origin !== 'http://b1.invalid') {
        unexpected.push(req.url());
        return route.abort('blockedbyclient');
      }
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: JSON.stringify(data) });
      if (req.method() === 'OPTIONS') return reply({});
      if (req.method() === 'POST' && url.pathname === '/operations') {
        const body = req.postDataJSON();
        posts.push(body);
        if (failPost) return reply({ message: 'Fallo sintético B1' }, 400);
        const op = { ...body, id: `synthetic-op-${posts.length}`, codigo: `B1-${posts.length}`, ts: '2026-10-17T12:00:00Z',
          contra: '100000', cotiz: body.cotiz ?? '1000', status: 'pendiente', operadorId: 'synthetic-operator',
          clienteId: body.clienteId ?? null, notas: null };
        operations = [...operations, op];
        return reply(op, 201);
      }
      if (req.method() === 'GET' && url.pathname === '/quotations') return reply([
        { par: 'USD/ARS', base: 'USD', quote: 'ARS', nombre: 'Par sintético', compra: '1000', venta: '1010', decimals: 2 },
      ]);
      if (req.method() === 'GET' && url.pathname === '/customers') return reply({ data: [
        { id: 'synthetic-cliente', nombre: 'Cliente sintético B1', cuentas: [] },
      ] });
      if (req.method() === 'GET' && url.pathname === '/operations') return reply({ data: operations });
      if (req.method() === 'GET' && url.pathname.startsWith('/operations/kpis/')) return reply({ stats: [] });
      unexpected.push(req.url());
      return route.abort('blockedbyclient');
    });
    // Next HMR is local only; no websocket may reach an external host.
    await context.routeWebSocket(/.*/, ws => {
      if (new URL(ws.url()).host === new URL(origin).host) ws.connectToServer();
      else { unexpected.push(ws.url()); ws.close(); }
    });
    await context.addInitScript(theme => localStorage.setItem('of-theme', theme), theme);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/b1-harness`);
    await page.waitForFunction(() => window.__b1Caja && !window.__b1Caja.loading);
    console.log('Initial provider:', await page.evaluate(() => ({ error: window.__b1Caja.error,
      pares: window.__b1Caja.state.pares.length })), 'unexpected:', unexpected, 'pageErrors:', errors);
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const alert = page.locator('section [role="alert"]');
    assert.equal(await alert.count(), 0);
    // Real UI → real dispatch: free text without FK must not POST.
    await page.getByPlaceholder('cliente', { exact: true }).first().fill('Cliente sólo texto sintético');
    const monto = page.getByPlaceholder('monto USD', { exact: true }).first();
    await monto.fill('100');
    await monto.press('Enter');

    await alert.waitFor({ state: 'visible' });
    assert.match(await alert.innerText(), /clienteId/);
    assert.equal(posts.length, 0, 'rejected UI payload must not POST');
    assert.equal(await alert.locator('button').count(), 0, 'no inert close button');
    const colors = await alert.evaluate(el => {
      const style = getComputedStyle(el);
      const root = getComputedStyle(document.documentElement);
      const sample = document.createElement('div');
      sample.style.backgroundColor = 'var(--danger-subtle)';
      sample.style.color = 'var(--text-primary)';
      document.body.append(sample);
      const expected = getComputedStyle(sample);
      const result = { background: style.backgroundColor, text: style.color, expectedBackground: expected.backgroundColor,
        expectedText: expected.color, token: root.getPropertyValue('--danger-subtle').trim() };
      sample.remove();
      return result;
    });
    assert.equal(colors.background, colors.expectedBackground);
    assert.equal(colors.text, colors.expectedText);
    assert.notEqual(colors.background, 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: `b1-${theme}-alert.png`, fullPage: true });
    // Bridge exposes only the actual context value, no business logic.
    await page.evaluate(() => window.__b1Caja.dispatch({ type: 'ADD_OP', payload: {
      tipo: 'C', par: 'USD/ARS', monto: '100', cotiz: '1000', cliente: 'Cliente sintético B1', clienteId: 'synthetic-cliente',
    } }));
    await page.waitForFunction(() => window.__b1Caja.state.operaciones.length === 1 && window.__b1Caja.error === null);
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0], { tipo: 'C', parId: 'USD/ARS', monto: '100', cotiz: '1000', cobertura: 'efectivo', clienteId: 'synthetic-cliente' });
    assert.equal(await alert.count(), 0, 'success clears rejection');
    assert.equal(await page.evaluate(() => window.__b1Caja.state.operaciones[0].clienteId), 'synthetic-cliente');
    // FK alone is also preserved; HTTP failures must be visible.
    failPost = true;
    await page.evaluate(() => window.__b1Caja.dispatch({ type: 'ADD_OP', payload: {
      tipo: 'C', par: 'USD/ARS', monto: 100, clienteId: 'synthetic-cliente',
    } }));
    await page.waitForFunction(() => window.__b1Caja.error === 'Fallo sintético B1');
    assert.equal(posts.length, 2);
    assert.equal(posts[1].clienteId, 'synthetic-cliente');
    assert.match(await alert.innerText(), /^Error:\s+Fallo sintético B1$/);
    // Preserve anonymous-operation contract and clear previous API error.
    failPost = false;
    await page.evaluate(() => window.__b1Caja.dispatch({ type: 'ADD_OP', payload: {
      tipo: 'V', par: 'USD/ARS', monto: '50', cliente: '',
    } }));
    await page.waitForFunction(() => window.__b1Caja.state.operaciones.length === 2 && window.__b1Caja.error === null);
    assert.equal(posts.length, 3);
    assert.equal(Object.hasOwn(posts[2], 'clienteId'), false);
    await page.waitForTimeout(200);
    assert.deepEqual(unexpected, [], 'no unexpected API/external traffic');
    assert.deepEqual(errors, [], 'no browser runtime errors');
    results.push({ theme, cases: ['UI rejection/no POST/visible alert', 'FK POST body/state/success clears error',
      'FK-only API failure visible', 'anonymous POST/success clears error'], posts, colors });
    console.log(`PASS ${theme}: UI rejection + actual provider dispatch + HTTP bodies + API error + anonymous + semantic tokens`);
    await context.close();
  }
  assert.notEqual(results[0].colors.background, results[1].colors.background);
  writeFileSync('b1-browser-results.json', JSON.stringify(results, null, 2));
  console.log('PASS B1 runtime: both themes; external traffic blocked before navigation; zero unexpected requests/errors');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await once(server, 'exit');
  serverLog.end();
}
