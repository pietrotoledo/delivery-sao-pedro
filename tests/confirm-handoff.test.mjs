import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function setup(t, method = 'delivery') {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE orders(id TEXT PRIMARY KEY, method TEXT, status TEXT, phone TEXT, paid_at TEXT,
    contact_deleted_at TEXT, handoff_attempts INTEGER DEFAULT 0, handoff_locked_until TEXT,
    handoff_confirmed_at TEXT, handoff_note TEXT, updated_at TEXT);`);
  sqlite.prepare('INSERT INTO orders(id,method,status,phone,paid_at) VALUES(?,?,?,?,?)')
    .run('order-1', method, method === 'delivery' ? 'out_for_delivery' : 'ready', '+55 (83) 99912-3456', '2026-10-30');
  let reads = 0;
  const notices = [];
  const order = () => sqlite.prepare('SELECT * FROM orders WHERE id=?').get('order-1');
  const database = { prepare(sql) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } };
  } };
  const modules = {
    '@/lib/store': { db: () => database, getOrder: async () => { reads++; return order(); } },
    '@/lib/order-notifications': { scheduleOrderNotifications: (...args) => notices.push(args) },
  };
  const context = { exports: {}, require: name => modules[name], Date };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/confirm-handoff.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { sqlite, order, notices, reads: () => reads, confirm: context.exports.confirmHandoff };
}

test('entrega e retirada retornam a conclusão salva sem esperar uma segunda consulta', async t => {
  for (const method of ['delivery', 'pickup']) {
    const api = setup(t, method);
    const result = await api.confirm(api.order(), '3456', 'https://example.com');
    assert.equal(result.order.status, 'completed');
    assert.equal(result.order.handoff_confirmed_at, api.order().handoff_confirmed_at);
    assert.equal(result.order.handoff_note, api.order().handoff_note);
    assert.equal(api.reads(), 0);
    assert.equal(api.notices.length, 1);
  }
});

test('repetir código correto após perda da resposta confirma sem duplicar aviso ou alterar horário', async t => {
  const api = setup(t);
  const first = await api.confirm(api.order(), '3456', 'https://example.com');
  const repeat = await api.confirm(api.order(), '3456', 'https://example.com');
  assert.equal(repeat.order.handoff_confirmed_at, first.order.handoff_confirmed_at);
  assert.equal(api.notices.length, 1);
  assert.equal((await api.confirm(api.order(), '0000', 'https://example.com')).status, 409);
});

test('confirmações concorrentes do mesmo código retornam sucesso e notificam uma vez', async t => {
  const api = setup(t);
  const original = api.order();
  const results = await Promise.all([api.confirm(original, '3456', 'https://example.com'), api.confirm(original, '3456', 'https://example.com')]);
  assert.ok(results.every(result => result.order?.status === 'completed'));
  assert.equal(results[0].order.handoff_confirmed_at, results[1].order.handoff_confirmed_at);
  assert.equal(api.notices.length, 1);
});

test('código inválido e bloqueio por cinco erros continuam protegidos', async t => {
  const api = setup(t);
  assert.equal((await api.confirm(api.order(), '123', 'https://example.com')).status, 400);
  assert.equal(api.order().handoff_attempts, 0);
  for (let i = 0; i < 5; i++) {
    assert.equal((await api.confirm(api.order(), '0000', 'https://example.com')).status, i === 4 ? 429 : 400);
  }
  assert.equal((await api.confirm(api.order(), '3456', 'https://example.com')).status, 429);
  assert.equal(api.order().status, 'out_for_delivery');
  assert.equal(api.notices.length, 0);
});

test('pagamento, etapa, exclusão de contato e mudanças concorrentes são respeitados', async t => {
  for (const change of ["paid_at=NULL", "status='preparing'", "contact_deleted_at='2026-10-30'"]) {
    const api = setup(t);
    api.sqlite.exec(`UPDATE orders SET ${change}`);
    assert.equal((await api.confirm(api.order(), '3456', 'https://example.com')).status, 409);
    assert.equal(api.notices.length, 0);
  }
  const api = setup(t);
  const original = api.order();
  api.sqlite.exec("UPDATE orders SET status='refunded'");
  assert.equal((await api.confirm(original, '3456', 'https://example.com')).status, 409);
  assert.equal(api.order().status, 'refunded');
});
