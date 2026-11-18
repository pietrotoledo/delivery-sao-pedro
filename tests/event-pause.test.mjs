import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('vendas encerradas recusam pedidos antes de ler dados, reservar estoque ou criar cobrança', async () => {
  const announcement = { exports: {} };
  vm.runInNewContext(compile('../lib/event-announcement.ts'), announcement);
  const route = { exports: {}, require: name => {
    if (name === '@/lib/event-announcement') return announcement.exports;
    if (name === '@/lib/store') return {
      sameOrigin: () => true,
      json: (body, status) => Response.json(body, { status }),
      ensureSchema: () => assert.fail('Não deve acessar o banco durante a pausa'),
    };
    return {};
  } };
  vm.runInNewContext(compile('../app/api/orders/route.ts'), route);
  const response = await route.exports.POST({ json: () => assert.fail('Não deve processar o pedido durante a pausa') });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /pedidos voltam no final de novembro de 2026/);
});
