import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}) {
  const context = { exports: {}, require: name => imports[name], Response, Headers, URL };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

test('cardápio de consulta expõe somente dados públicos e mantém cache por um minuto', async () => {
  const route = load('../app/api/menu/route.ts', { '@/lib/store': {
    getProducts: async () => [{ id: 'burger', name: 'Burger', description: 'Descrição', category: 'burger', price: 2500, imageUrl: '/burger.webp', stock: 42, active: true, sortOrder: 1, ingredients: ['private detail'] }],
  } });
  const { secureResponse } = load('../lib/security-headers.ts');
  const response = secureResponse(new Request('https://store.example/api/menu'), await route.GET());
  assert.deepEqual(await response.json(), { products: [{ id: 'burger', name: 'Burger', description: 'Descrição', category: 'burger', price: 2500, imageUrl: '/burger.webp' }] });
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  for (const path of ['/api/orders', '/api/admin/settings', '/api/menu/private']) {
    const privateResponse = secureResponse(new Request(`https://store.example${path}`), Response.json({}, { headers: { 'Cache-Control': 'public, max-age=60' } }));
    assert.equal(privateResponse.headers.get('cache-control'), 'no-store');
  }
});
