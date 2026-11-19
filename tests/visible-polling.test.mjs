import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function setup(hidden = false) {
  const timers = new Map();
  const listeners = new Set();
  let id = 0;
  const document = {
    visibilityState: hidden ? 'hidden' : 'visible',
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  const context = { exports: {}, document,
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/visible-polling.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { ...context.exports, timers, listeners,
    visibility(value) { document.visibilityState = value; for (const fn of listeners) fn(); },
    async tick() { const next = timers.entries().next().value; assert.ok(next); timers.delete(next[0]); await next[1].fn(); },
  };
}

test('aba inicialmente oculta não consulta; retoma imediatamente e agenda 30 segundos', async () => {
  const h = setup(true); let calls = 0;
  const stop = h.startVisiblePolling(async () => { calls++; }, 30000);
  assert.equal(h.timers.size, 0);
  h.visibility('visible');
  assert.equal([...h.timers.values()][0].ms, 0);
  await h.tick();
  assert.equal(calls, 1);
  assert.equal([...h.timers.values()][0].ms, 30000);
  h.visibility('hidden');
  assert.equal(h.timers.size, 0);
  h.visibility('visible'); await h.tick();
  assert.equal(calls, 2);
  stop();
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});

test('requisição em andamento não se sobrepõe e não reagenda depois de parar', async () => {
  const h = setup(); let finish; let calls = 0;
  const stop = h.startVisiblePolling(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, 30000);
  const pending = h.tick();
  h.visibility('hidden'); h.visibility('visible');
  assert.equal(h.timers.size, 0); assert.equal(calls, 1);
  stop(); finish(); await pending;
  assert.equal(h.timers.size, 0);
});

test('falha na rede permite nova tentativa no próximo intervalo', async () => {
  const h = setup(); let calls = 0;
  const stop = h.startVisiblePolling(async () => { calls++; throw Error('offline'); }, 30000);
  await h.tick(); await h.tick();
  assert.equal(calls, 2); stop();
});

test('apenas estados finais encerram o acompanhamento automático', () => {
  const h = setup();
  for (const status of ['completed', 'expired', 'refunded']) assert.equal(h.orderPollingFinished(status), true);
  for (const status of [undefined, 'paid', 'preparing', 'ready', 'out_for_delivery', 'awaiting_payment']) assert.equal(h.orderPollingFinished(status), false);
});
