import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}, extra = {}) {
  const context = { exports: {}, require: name => imports[name], crypto: globalThis.crypto, TextEncoder, Date, Response, Headers, URL, ...extra };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

test('sessão admin é única, assinada e expira no servidor; adulteração e token antigo são recusados', async () => {
  let now = 1795000000000;
  const session = load('../lib/admin-session.ts', {}, { Date: class extends Date { static now() { return now; } } });
  const secret = 'test-only-secret';
  const token = await session.createAdminSession(secret);
  assert.notEqual(token, await session.createAdminSession(secret));
  assert.equal(await session.verifyAdminSession(token, secret), true);
  assert.equal(await session.verifyAdminSession(token + 'x', secret), false);
  assert.equal(await session.verifyAdminSession(token.replace(/^\d/, '0'), secret), false);
  assert.equal(await session.verifyAdminSession(token, 'rotated-secret'), false);
  assert.equal(await session.verifyAdminSession('a'.repeat(64), secret), false);
  now -= 1000;
  assert.equal(await session.verifyAdminSession(token, secret), false);
  now += 1000 + session.adminSessionLifetime * 1000;
  assert.equal(await session.verifyAdminSession(token, secret), false);
});

test('proteção de origem recusa origem ausente, outro domínio e Fetch Metadata cross-site', () => {
  const store = load('../lib/store.ts', { 'cloudflare:workers': { env: {} }, './menu-options': {}, './admin-session': {} });
  const request = headers => new Request('https://store.example/api/admin/settings', { method: 'POST', headers });
  assert.equal(store.sameOrigin(request({ origin: 'https://store.example' })), true);
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://evil.example' }, { origin: 'https://store.example', 'sec-fetch-site': 'cross-site' }]) {
    assert.equal(store.sameOrigin(request(headers)), false);
  }
});

test('limite de login é atômico, separado por perfil e endereço, e libera na próxima janela', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const database = { prepare(sql) { let values = []; return {
    bind(...args) { values = args; return this; },
    async run() { return sqlite.prepare(sql).run(...values); },
    async first() { return sqlite.prepare(sql).get(...values); },
  }; } };
  let now = 1795000000000;
  const limiter = load('../lib/login-limit.ts', { './store': { db: () => database } }, { Date: class extends Date { static now() { return now; } } });
  const request = address => new Request('https://store.example/api/admin/login', { headers: { 'cf-connecting-ip': address } });
  const results = await Promise.all(Array.from({length: 15}, () => limiter.allowLogin(request('192.0.2.1'), 'admin')));
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(await limiter.allowLogin(request('192.0.2.1'), 'delivery'), true);
  assert.equal(await limiter.allowLogin(request('192.0.2.2'), 'admin'), true);
  assert.ok(sqlite.prepare('SELECT id FROM login_attempts').all().every(row => !row.id.includes('192.0.2')));
  now += 600000;
  assert.equal(await limiter.allowLogin(request('192.0.2.1'), 'admin'), true);
  assert.equal(limiter.loginLimited().status, 429);
  sqlite.close();
});

test('cabeçalhos protegem páginas sensíveis sem perder cookies nem o corpo da resposta', async () => {
  const { secureResponse } = load('../lib/security-headers.ts');
  const response = secureResponse(new Request('https://store.example/equipe/pedido/123?token=secret'), new Response('hello', { headers: { 'Set-Cookie': 'example=value; HttpOnly' } }));
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('set-cookie'), 'example=value; HttpOnly');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(await response.text(), 'hello');
});
