import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports) {
  const context = { exports: {}, require: name => imports[name] };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

const schedule = load('../lib/event-schedule.ts', { './event-location': { eventLocation: { name: 'Evidence', address: 'Rua' } } });

test('scheduled reminders select eligible paid orders and register each event once', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, paid_at TEXT, contact_deleted_at TEXT, whatsapp_opt_in INTEGER,
    status TEXT, payment_mode TEXT, payment_note TEXT, created_at TEXT, method TEXT);
    CREATE TABLE order_notifications (id TEXT PRIMARY KEY,order_id TEXT,event TEXT,message TEXT,updated_at TEXT,UNIQUE(order_id,event));`);
  const base = ['2026-10-29T12:00:00.000Z', null, 1, 'paid', 'infinitepay', null, '2026-10-29', 'delivery'];
  const insert = sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)');
  insert.run('eligible', ...base);
  for (const [id, index, value] of [['unpaid', 0, null], ['deleted', 1, '2026-10-29'], ['no-consent', 2, 0],
    ['completed', 3, 'completed'], ['refunded', 3, 'refunded'], ['demo', 4, 'demo'],
    ['test', 5, 'TESTE SEM PAGAMENTO REAL - autorizado'], ['paid-later', 0, '2026-10-30T14:01:00.000Z']]) {
    const values = [...base]; values[index] = value; insert.run(id, ...values);
  }
  const database = {
    prepare(sql) {
      let values = [];
      return { bind(...args) { values = args; return this; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { return sqlite.prepare(sql).run(...values); } };
    },
    async batch(statements) { for (const statement of statements) await statement.run(); },
  };
  const { queueEventReminders } = load('../lib/event-reminders.ts', {
    './store': { db: () => database, ensureSchema: async () => {} },
    './notification-queue': load('../lib/notification-queue.ts', { './store': { db: () => database } }),
    './event-schedule': schedule,
    './evolution-notifications': { evolutionEnabled: () => true, orderNoticeMessage: (_, event) => event },
  });
  await queueEventReminders(new Date('2026-10-30T13:59:59Z'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM order_notifications').get().count, 0);
  await queueEventReminders(new Date('2026-10-30T14:00:00Z'));
  await queueEventReminders(new Date('2026-10-30T14:02:00Z'));
  const morning = sqlite.prepare('SELECT order_id,event FROM order_notifications').all();
  assert.deepEqual(morning.map(x => [x.order_id,x.event]), [['eligible','event_morning']]);
  await queueEventReminders(new Date('2026-10-30T21:00:00Z'));
  const evening = sqlite.prepare("SELECT order_id FROM order_notifications WHERE event='event_evening' ORDER BY order_id").all();
  assert.deepEqual(evening.map(x => x.order_id), ['eligible','paid-later']);
  await queueEventReminders(new Date('2027-10-30T14:00:00Z'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM order_notifications').get().count, 3);
  sqlite.close();
});

test('payment confirmation contains the event date and the correct delivery or pickup schedule', () => {
  const { orderNoticeMessage } = load('../lib/evolution-notifications.ts', {
    'cloudflare:workers': {}, './store': {}, './event-schedule': schedule,
  });
  const order = { id: 'example-order', method: 'delivery' };
  const paid = orderNoticeMessage(order, 'paid', 'https://example.com');
  assert.match(paid, /Pagamento confirmado/);
  assert.match(paid, /30 de outubro de 2026/);
  assert.match(paid, /19h/);
  assert.match(orderNoticeMessage({ ...order, method: 'pickup' }, 'paid', 'https://example.com'), /18h às 22h/);
  for (const event of ['event_morning','event_evening']) {
    const text = orderNoticeMessage(order, event, 'https://example.com');
    assert.match(text, /É hoje/);
    assert.match(text, /19h/);
    assert.match(text, /https:\/\/example.com\/pedido\/example-order/);
  }
});

test('payment confirmation asks to calculate the Uber Moto fee only when delivery fee is to be arranged', () => {
  const { orderNoticeMessage } = load('../lib/evolution-notifications.ts', {
    'cloudflare:workers': {}, './store': {}, './event-schedule': schedule,
  });
  const order = { id: 'example-order', method: 'delivery', delivery_fee: null, total: 3000 };
  assert.match(orderNoticeMessage(order, 'paid', 'https://example.com'), /calcular o seu frete pelo Uber Moto/);
  assert.doesNotMatch(orderNoticeMessage({ ...order, delivery_fee: 500, total: 3500 }, 'paid', 'https://example.com'), /Uber Moto/);
  assert.doesNotMatch(orderNoticeMessage({ ...order, method: 'pickup', delivery_fee: 0 }, 'paid', 'https://example.com'), /Uber Moto/);
  assert.doesNotMatch(orderNoticeMessage(order, 'preparing', 'https://example.com'), /Uber Moto/);
});
