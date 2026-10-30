import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(fetch) {
  const context = { exports: {}, fetch, AbortController, setTimeout, clearTimeout, TypeError };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/client-request.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('timeout cancela a espera pelos cabeçalhos e libera uma nova tentativa', async () => {
  let attempts = 0, aborted = false;
  const { requestJson } = load(async (_, { signal }) => {
    if (++attempts === 2) return Response.json({ ok: true });
    return new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }));
  });
  await assert.rejects(requestJson('/api/admin', {}, 10), { name: 'RequestTimeoutError' });
  assert.equal(aborted, true);
  assert.equal((await requestJson('/api/admin')).result.ok, true);
});

test('timeout também cobre a leitura do corpo da resposta', async () => {
  const { requestJson } = load(async (_, { signal }) => ({
    json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  }));
  await assert.rejects(requestJson('/api/admin', {}, 10), { name: 'RequestTimeoutError' });
});

test('respostas HTML e falhas de rede têm mensagens utilizáveis', async () => {
  const html = load(async () => new Response('<html>Indisponivel</html>', { status: 502 }));
  await assert.rejects(html.requestJson('/api/admin'), /resposta inválida/);
  const offline = load(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.requestJson('/api/admin'), /Confira sua internet/);
});

test('polling e eventos compartilham a requisição lenta sem descartar seu resultado', async () => {
  const { singleFlight } = load();
  const first = deferred();
  let calls = 0, applied = 0;
  const run = singleFlight();
  const task = async () => { calls++; await first.promise; applied++; };
  const reload = fresh => run(task, fresh);
  const pending = reload();
  await Promise.resolve();
  assert.equal(reload(), pending);
  assert.equal(reload(), pending);
  assert.equal(calls, 1);
  first.resolve();
  await pending;
  assert.equal(applied, 1);
  await reload();
  assert.equal(calls, 2);
});

test('após uma mutação a leitura é nova, mesmo com consulta anterior pendente ou falhando', async () => {
  for (const fail of [false, true]) {
    const { singleFlight } = load();
    const first = deferred();
    let calls = 0;
    const run = singleFlight();
    const task = async () => { if (++calls === 1) await first.promise; };
    const reload = fresh => run(task, fresh);
    const pending = reload();
    const fresh = reload(true);
    const anotherFresh = reload(true);
    const caught = pending.catch(() => {});
    if (fail) first.reject(new Error('offline')); else first.resolve();
    await Promise.all([caught, fresh, anotherFresh]);
    assert.equal(calls, 2);
  }
});

test('trocar de pedido agenda a nova consulta após a anterior', async () => {
  const { singleFlight } = load();
  const run = singleFlight(), first = deferred();
  let nextCalls = 0;
  const pending = run(() => first.promise);
  const next = run(async () => { nextCalls++; });
  first.resolve();
  await Promise.all([pending, next]);
  assert.equal(nextCalls, 1);
});
