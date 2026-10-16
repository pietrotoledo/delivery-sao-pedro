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

function setup(options = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, paid_at TEXT, status TEXT, phone TEXT, email TEXT,
    contact_deleted_at TEXT,whatsapp_opt_in INTEGER,method TEXT,checkout_url TEXT,payment_mode TEXT,payment_note TEXT,created_at TEXT);`);
  const stats = { queries: 0, requests: 0, posts: 0, emails: 0, effects: 0 };
  let failWrite = options.failAcceptedWrite;
  let failPost = options.loseResponse;
  let offline = options.offline;
  let throttle = options.throttle;
  let payDuringClaim = options.payDuringClaim;
  const database = {
    prepare(sql) {
      let values = [];
      return { bind(...args) { values = args; return this; },
        async run() {
          stats.queries++;
          if (failWrite && sql.includes("order_notifications SET state='accepted'")) {
            failWrite = false; throw Error('Simulated persistence failure after provider acceptance');
          }
          const result = sqlite.prepare(sql).run(...values);
          if (payDuringClaim && sql.includes("email_notifications SET state='sending'")) {
            payDuringClaim = false;
            sqlite.exec("UPDATE orders SET paid_at='2026-10-16T00:00:00Z',status='paid'");
          }
          return { meta: { changes: result.changes } };
        },
        async first() { stats.queries++; return sqlite.prepare(sql).get(...values); },
        async all() { stats.queries++; return { results: sqlite.prepare(sql).all(...values) }; },
      };
    },
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
  };
  const env = { DB: database, RESEND_API_KEY: 'mock', RESEND_FROM_EMAIL: 'sender@example.invalid',
    EVOLUTION_API_URL: 'https://example.invalid', EVOLUTION_API_KEY: 'mock', EVOLUTION_INSTANCE: 'mock' };
  const store = load('../lib/store.ts', { 'cloudflare:workers': { env }, './menu-options': {} });
  const queue = load('../lib/notification-queue.ts', { './store': store });
  const schedule = load('../lib/event-schedule.ts', { './event-location': { eventLocation: { name: 'Example', address: 'Example' } } });
  const extra = { URL, Date, AbortSignal, console, fetch: async (url) => {
    stats.requests++;
    if (url.includes('/connectionState/')) {
      if (offline) throw Error('Simulated offline provider');
      return { ok: true, json: async () => ({ instance: { state: 'open' } }) };
    }
    if (url.includes('resend.com')) stats.emails++;
    else {
      stats.posts++;
      if (throttle) { throttle = false; return { ok: false, status: 429 }; }
    }
    stats.effects++;
    if (failPost) { failPost = false; throw Error('Simulated lost response after acceptance'); }
    return { ok: true, json: async () => ({ id: 'resend-id', key: { id: 'whatsapp-id' } }) };
  } };
  const imports = { 'cloudflare:workers': { env }, './store': store, './notification-queue': queue, './event-schedule': schedule };
  const wa = load('../lib/evolution-notifications.ts', imports, extra);
  const email = load('../lib/email-notifications.ts', { ...imports, './evolution-notifications': wa }, extra);
  const combined = load('../lib/order-notifications.ts', { './evolution-notifications': wa, './email-notifications': email });
  const reminders = load('../lib/event-reminders.ts', { ...imports, './evolution-notifications': wa });
  return { sqlite, stats, queue, wa, email, combined, reminders, online() { offline = false; },
    coldStart() { queue.ensureNotificationSchema = load('../lib/notification-queue.ts', { './store': store }).ensureNotificationSchema; },
    async seed(channel, id, event = 'pix_available', paid = false) {
      await queue.ensureNotificationSchema();
      sqlite.prepare('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,NULL,1,?,?,?,?,?)')
        .run(id, paid ? '2026-10-29T00:00:00.000Z' : null, paid ? 'paid' : 'awaiting_payment',
          '5583991234567', 'test@example.invalid', 'delivery', 'https://example.invalid/pix', 'infinitepay', null, '2026-10-29');
      const table = channel === 'email' ? 'email_notifications' : 'order_notifications';
      if (channel === 'email') sqlite.prepare(`INSERT INTO ${table} (id,order_id,event,subject,message,updated_at) VALUES (?,?,?,?,?,'2020-01-01')`)
        .run(id + ':' + event, id, event, 'Example', 'Example');
      else sqlite.prepare(`INSERT INTO ${table} (id,order_id,event,message,updated_at) VALUES (?,?,?,?,'2020-01-01')`)
        .run(id + ':' + event, id, event, 'Example');
    },
    state(channel, id, event = 'pix_available') {
      return sqlite.prepare(`SELECT state FROM ${channel === 'email' ? 'email_notifications' : 'order_notifications'} WHERE id=?`).get(id + ':' + event)?.state;
    },
  };
}

test('paid Pix notices are suppressed in both channels without contacting providers', async () => {
  const h = setup();
  await h.seed('email', 'email-paid', 'pix_available', true);
  await h.seed('whatsapp', 'wa-paid', 'pix_available', true);
  await h.combined.retryOrderNotifications();
  assert.equal(h.state('email', 'email-paid'), 'superseded');
  assert.equal(h.state('whatsapp', 'wa-paid'), 'superseded');
  assert.equal(h.stats.requests, 0);
});

test('payment confirmed during claim is checked again before sending the Pix email', async () => {
  const h = setup({ payDuringClaim: true });
  await h.seed('email', 'paid-during-claim');
  await h.email.retryEmailNotifications();
  assert.equal(h.stats.emails, 0);
  assert.equal(h.state('email', 'paid-during-claim'), 'superseded');
});

for (const [name, options] of [['lost response', { loseResponse: true }], ['acceptance write failure', { failAcceptedWrite: true }]]) {
  test(`WhatsApp ${name} is held for review instead of automatically duplicated`, async () => {
    const h = setup(options);
    await h.seed('whatsapp', 'uncertain');
    await h.wa.retryEvolutionNotifications();
    assert.equal(h.state('whatsapp', 'uncertain'), 'uncertain');
    await h.wa.retryEvolutionNotifications();
    assert.equal(h.stats.effects, 1);
    assert.equal(h.stats.posts, 1);
  });
}

test('stale sending and legacy failed WhatsApps are not submitted again', async () => {
  const h = setup();
  await h.seed('whatsapp', 'stale');
  await h.seed('whatsapp', 'legacy');
  h.sqlite.exec("UPDATE order_notifications SET state='sending' WHERE order_id='stale'; UPDATE order_notifications SET state='failed',last_error='fetch failed' WHERE order_id='legacy'");
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state('whatsapp', 'stale'), 'uncertain');
  assert.equal(h.state('whatsapp', 'legacy'), 'uncertain');
  assert.equal(h.stats.posts, 0);
});

test('offline preflight retries automatically after recovery without submitting while offline', async () => {
  const h = setup({ offline: true });
  await h.seed('whatsapp', 'offline');
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state('whatsapp', 'offline'), 'failed');
  assert.equal(h.stats.posts, 0);
  h.online();
  h.sqlite.exec('UPDATE order_notifications SET next_attempt_at=NULL');
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state('whatsapp', 'offline'), 'accepted');
  assert.equal(h.stats.effects, 1);
});

test('confirmed rate-limit rejection can retry without duplicating an accepted message', async () => {
  const h = setup({ throttle: true });
  await h.seed('whatsapp', 'limited');
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state('whatsapp', 'limited'), 'failed');
  h.sqlite.exec('UPDATE order_notifications SET next_attempt_at=NULL');
  await h.wa.retryEvolutionNotifications();
  assert.equal(h.state('whatsapp', 'limited'), 'accepted');
  assert.equal(h.stats.effects, 1);
});

test('concurrent retry workers claim a WhatsApp only once', async () => {
  const h = setup();
  await h.seed('whatsapp', 'concurrent');
  await Promise.all([h.wa.retryEvolutionNotifications(), h.wa.retryEvolutionNotifications()]);
  assert.equal(h.stats.posts, 1);
});

test('cold notification schema, event registration and full mixed retry stay under 50 subrequests', async () => {
  const h = setup();
  for (let i = 0; i < 10; i++) {
    await h.seed('whatsapp', 'wa-' + i);
    await h.seed('email', 'email-' + i);
  }
  for (let i = 0; i < 12; i++) h.sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,NULL,1,?,?,?,?,?)')
    .run('reminder-' + i, '2026-10-29T00:00:00.000Z', 'paid', '5583991234567', 'test@example.invalid', 'delivery', null, 'infinitepay', null, '2026-10-29');
  // Seed data is outside the invocation; reload schema initialization as a cold worker would.
  h.coldStart();
  h.stats.queries = 0;
  await h.reminders.queueEventReminders(new Date('2026-10-30T14:00:00Z'));
  await h.combined.retryOrderNotifications();
  assert.equal(h.stats.posts, h.queue.notificationBatch.whatsapp);
  assert.equal(h.stats.emails, h.queue.notificationBatch.email);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) AS n FROM order_notifications WHERE event='event_morning'").get().n, h.queue.notificationBatch.reminders);
  assert.ok(h.stats.queries + h.stats.requests < 50, JSON.stringify(h.stats));
  assert.equal(h.stats.queries + h.stats.requests, 44);
});
