import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('eventos não conectam em aba oculta; reabrem ao voltar e fecham ao sair', async () => {
  let cleanup; let refreshes = 0;
  const listeners = new Map(), connections = [];
  const document = { visibilityState: 'hidden',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const window = { addEventListener() {}, removeEventListener() {} };
  class EventSource {
    constructor() { connections.push(this); this.closed = false; }
    addEventListener(_, fn) { this.sync = fn; }
    close() { this.closed = true; }
  }
  const context = { exports: {}, document, window, EventSource, require: () => ({
    useState: () => [false, () => {}], useEffect: fn => { cleanup = fn(); },
  }) };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/use-delivery-sync.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  context.exports.default(true, async () => { refreshes++; });
  assert.equal(connections.length, 0);
  document.visibilityState = 'visible'; listeners.get('visibilitychange')();
  assert.equal(connections.length, 1);
  await connections[0].sync(); assert.equal(refreshes, 1);
  document.visibilityState = 'hidden'; listeners.get('visibilitychange')();
  assert.equal(connections[0].closed, true);
  await connections[0].sync(); assert.equal(refreshes, 1);
  document.visibilityState = 'visible'; listeners.get('visibilitychange')();
  assert.equal(connections.length, 2);
  await connections[1].sync(); assert.equal(refreshes, 2);
  cleanup();
  assert.equal(connections[1].closed, true); assert.equal(listeners.size, 0);
});
