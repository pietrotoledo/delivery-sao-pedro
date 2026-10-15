import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/phone.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { normalizeBrazilianMobile, brazilianMobileError, formatBrazilianMobile } = context.exports;

test('aceita celular com DDD, formatação e código do Brasil', () => {
  for (const value of ['83999123456', '(83) 99912-3456', '+55 (83) 99912-3456', '5583999123456', ' 83 99912 3456 ']) {
    assert.equal(normalizeBrazilianMobile(value), '5583999123456');
  }
});

test('distingue DDD 55 do código do país e normaliza sem duplicar prefixo', () => {
  assert.equal(normalizeBrazilianMobile('(55) 99912-3456'), '5555999123456');
  assert.equal(normalizeBrazilianMobile('+55 (55) 99912-3456'), '5555999123456');
  const normalized = normalizeBrazilianMobile('(83) 99912-3456');
  assert.equal(normalizeBrazilianMobile(normalized), normalized);
});

test('rejeita DDD inexistente, telefone fixo, dados falsos e excesso sem truncar', () => {
  for (const value of ['', '999123456', '00999123456', '23999123456', '8399912345', '8332123456', '83899123456', '83999999999', '83000000000', '558399912345699', '+1 83999123456', '+83 999123456', 'abc83999123456', '83+999123456', null, 83999123456]) {
    assert.equal(normalizeBrazilianMobile(value), null, String(value));
  }
});

test('API bloqueia telefone inválido antes de acessar o banco ou gerar pagamento', async () => {
  const route = { exports: {}, crypto: globalThis.crypto, TextEncoder, require: name => {
    if (name === '@/lib/phone') return context.exports;
    if (name === '@/lib/store') return { sameOrigin: () => true, json: (body, status) => Response.json(body, {status}) };
    return {};
  } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, route);
  for (const phone of ['83999999999', '23999123456', '558399912345699', null]) {
    const response = await route.exports.POST(new Request('https://example.com/api/orders', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestKey: '455f490c-dbe4-4c16-8035-4affaba09de7', phone}) }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, brazilianMobileError(phone));
  }
});

test('formata digitação e colagem sem esconder excesso ou letras', () => {
  for (const [raw, expected] of [['8', '8'], ['83', '83'], ['839', '(83) 9'], ['8399912', '(83) 99912'], ['83999123456', '(83) 99912-3456'], ['5583999123456', '+55 (83) 99912-3456'], ['+55 (55) 99912-3456', '+55 (55) 99912-3456'], ['558399912345699', '558399912345699'], ['83999123456abc', '83999123456abc']]) {
    assert.equal(formatBrazilianMobile(raw), expected);
  }
});

test('explica o motivo específico da recusa', () => {
  for (const [value, message] of [['', /Informe seu celular/], ['999123456', /Inclua os 2 números do DDD/], ['8399912345', /incompleto/], ['23999123456', /Confira o DDD/], ['83899123456', /começar com 9/], ['83999999999', /todos iguais/], ['558399912345699', /números a mais/], ['+1 83999123456', /Brasil/]]) {
    assert.match(brazilianMobileError(value), message);
  }
  assert.equal(brazilianMobileError('(83) 99912-3456'), null);
});
