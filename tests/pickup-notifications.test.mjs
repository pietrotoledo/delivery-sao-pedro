import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports, extra = {}) {
  const context = { exports: {}, require: name => imports[name], ...extra };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

async function setup({ status = 'completed', event = 'ready', method = 'pickup', completeDuringPreflight = false } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const database = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
      async first() { return sqlite.prepare(sql).get(...values); },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    };
  } };
  const order = { id: 'pickup-order', method, status, paid_at: '2026-10-30', phone: '5583991234567', whatsapp_opt_in: 1 };
  const store = { db: () => database, ensureSchema: async () => {}, getOrder: async () => ({ ...order }) };
  const queue = load('../lib/notification-queue.ts', { './store': store });
  await queue.ensureNotificationSchema();
  sqlite.exec('CREATE TABLE orders (id TEXT, paid_at TEXT, status TEXT)');
  sqlite.prepare('INSERT INTO orders VALUES (?,?,?)').run(order.id, order.paid_at, status);
  sqlite.prepare('INSERT INTO order_notifications (id,order_id,event,message,updated_at) VALUES (?,?,?,?,?)')
    .run('notice', order.id, event, 'Previously queued message', '2020-01-01');
  const stats = { requests: 0, messages: 0 };
  const wa = load('../lib/evolution-notifications.ts', {
    './store': store, './notification-queue': queue,
    'cloudflare:workers': { env: { EVOLUTION_API_URL: 'https://example.invalid', EVOLUTION_API_KEY: 'mock', EVOLUTION_INSTANCE: 'mock' } },
    './event-schedule': { isEventReminder: () => false },
  }, { URL, Date, AbortSignal, console, fetch: async url => {
    stats.requests++;
    if (url.includes('/connectionState/')) {
      if (completeDuringPreflight) order.status = 'completed';
      return { ok: true, json: async () => ({ instance: { state: 'open' } }) };
    }
    stats.messages++;
    return { ok: true, json: async () => ({ key: { id: 'provider-id' } }) };
  } });
  return { wa, order, stats, sqlite, state: () => sqlite.prepare("SELECT state FROM order_notifications WHERE id='notice'").get().state };
}

for (const event of ['paid', 'preparing', 'ready', 'completed']) {
  test(`retirada concluída cancela WhatsApp pendente de ${event} sem chamar Evolution`, async () => {
    const h = await setup({ event });
    assert.equal(h.wa.orderNoticeMessage(h.order, event, 'https://example.invalid'), null);
    await h.wa.retryEvolutionNotifications();
    assert.equal(h.state(), 'superseded');
    assert.equal(h.stats.requests, 0);
    h.sqlite.close();
  });
}

test('retirada concluída durante a verificação de conexão não recebe mensagem', async () => {
  const h = await setup({ status: 'ready', completeDuringPreflight: true });
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'superseded');
  assert.equal(h.stats.messages, 0);
  h.sqlite.close();
});

test('retirada ainda não concluída continua recebendo aviso de pedido pronto', async () => {
  const h = await setup({ status: 'ready' });
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'accepted');
  assert.equal(h.stats.messages, 1);
  h.sqlite.close();
});

test('entrega mantém sua mensagem de conclusão', async () => {
  const h = await setup({ method: 'delivery', event: 'completed' });
  assert.match(h.wa.orderNoticeMessage(h.order, 'completed', 'https://example.invalid'), /finalizado/);
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'accepted');
  assert.equal(h.stats.messages, 1);
  h.sqlite.close();
});
