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
  const pending = [];
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
    'cloudflare:workers': { env: { EVOLUTION_API_URL: 'https://example.invalid', EVOLUTION_API_KEY: 'mock', EVOLUTION_INSTANCE: 'mock' }, waitUntil: task => pending.push(task) },
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
  return { wa, order, stats, sqlite, pending, state: () => sqlite.prepare("SELECT state FROM order_notifications WHERE id='notice'").get().state };
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

test('entrega mantém a conclusão por e-mail, mas não manda WhatsApp de conclusão', async () => {
  const h = await setup({ method: 'delivery', event: 'completed' });
  assert.match(h.wa.orderNoticeMessage(h.order, 'completed', 'https://example.invalid'), /finalizado/);
  assert.equal(h.wa.whatsappNoticeMessage(h.order, 'completed', 'https://example.invalid'), null);
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'superseded');
  assert.equal(h.stats.requests, 0);
  h.sqlite.close();
});

for (const [name, event, order] of [
  ['em preparo', 'preparing', {}],
  ['pronto na entrega', 'ready', { method: 'delivery' }],
  ['pagamento confirmado no presencial', 'paid', { payment_mode: 'manual' }],
  ['lembrete das 11h', 'event_morning', {}],
  ['lembrete das 18h', 'event_evening', {}],
]) {
  test(`WhatsApp deixa de mandar ${name}`, async () => {
    const h = await setup({ status: 'paid', event });
    Object.assign(h.order, order);
    assert.equal(h.wa.whatsappNoticeMessage(h.order, event, 'https://example.invalid'), null);
    await h.wa.retryEvolutionNotifications();
    assert.equal(h.state(), 'superseded');
    assert.equal(h.stats.requests, 0);
    h.sqlite.close();
  });
}

test('Pix só vira WhatsApp depois de 15 minutos sem pagamento', async () => {
  const h = await setup({ status: 'awaiting_payment', method: 'delivery' });
  Object.assign(h.order, { paid_at: null, checkout_url: 'https://example.invalid/pix' });
  h.wa.scheduleOrderNotice(h.order.id, 'pix_available', 'https://example.invalid');
  await Promise.all(h.pending);
  const row = h.sqlite.prepare("SELECT state,next_attempt_at,message FROM order_notifications WHERE event='pix_available'").get();
  assert.equal(row.state, 'pending');
  assert.match(row.message, /ainda está aguardando o Pix/);
  const wait = Date.parse(row.next_attempt_at) - Date.now();
  assert.ok(wait > 14 * 60_000 && wait <= 15 * 60_000, String(wait));
  assert.equal(h.stats.requests, 0);
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.stats.requests, 0, 'agendamento não antecipa o lembrete');
  h.sqlite.close();
});

test('WhatsApp não manda duas mensagens seguidas sem o intervalo mínimo', async () => {
  const h = await setup({ status: 'ready' });
  h.sqlite.prepare("INSERT INTO order_notifications (id,order_id,event,message,state,accepted_at,updated_at) VALUES ('recent','other','paid','x','accepted',?,?)")
    .run(new Date().toISOString(), new Date().toISOString());
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'pending');
  assert.equal(h.stats.requests, 0);
  h.sqlite.exec(`UPDATE order_notifications SET accepted_at='${new Date(Date.now() - h.wa.whatsappGap.minSeconds * 1000 - 1000).toISOString()}' WHERE id='recent'`);
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state(), 'accepted');
  h.sqlite.close();
});
