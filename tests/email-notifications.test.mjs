import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, imports, extra = {}) {
  const context = { exports: {}, require: name => imports[name], ...extra };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

const events = ['pix_available', 'paid', 'preparing', 'ready', 'out_for_delivery', 'completed'];
const schedule = loadModule('../lib/event-schedule.ts', { './event-location': { eventLocation: { name: 'Evidence', address: 'Rua' } } });
const queue = loadModule('../lib/notification-queue.ts', { './store': {} });

test('six order stages schedule six WhatsApp notices and two emails including the event date in Pix', async () => {
  const pending = [], emails = [], whatsapp = [], rows = new Map();
  const database = { prepare(sql) {
    let args;
    return {
      bind(...values) { args = values; return this; },
      async run() {
        if (sql.startsWith('INSERT')) rows.set(args[0], { id: args[0], order_id: args[1], event: args[2], subject: args[3], message: args[4], attempts: 1 });
        return { meta: { changes: 1 } };
      },
      async first() { return rows.get(args[0]); },
    };
  } };
  const email = loadModule('../lib/email-notifications.ts', {
    'cloudflare:workers': { env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'orders@example.com' }, waitUntil: p => pending.push(p) },
    './store': { db: () => database, ensureSchema: async () => {}, getOrder: async () => ({ id: 'order', email: 'customer@example.com', status: 'awaiting_payment', method: 'delivery' }) },
    './evolution-notifications': { orderNoticeMessage: (_, event) => `message:${event}` },
    './event-schedule': schedule,
    './notification-queue': queue,
  }, {
    URL, Date, console, AbortSignal,
    fetch: async (_, options) => { emails.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ id: 'email-id' }) }; },
  });
  const notifications = loadModule('../lib/order-notifications.ts', {
    './email-notifications': email,
    './evolution-notifications': { scheduleOrderNotice: (_, event) => whatsapp.push(event) },
  });
  for (const event of events) {
    notifications.scheduleOrderNotifications('order', event, 'https://example.com');
    await Promise.all(pending);
  }
  assert.deepEqual(whatsapp, events);
  assert.equal(emails.length, 2);
  assert.match(emails[0].text, /^message:pix_available/);
  assert.match(emails[0].text, /30 de outubro de 2026/);
  assert.match(emails[0].text, /19h/);
  assert.equal(emails[1].text, 'message:completed');
  assert.match(emails[1].subject, /Obrigado pela compra!/);
  notifications.scheduleOrderNotifications('order', 'event_morning', 'https://example.com');
  notifications.scheduleOrderNotifications('order', 'event_evening', 'https://example.com');
  await Promise.all(pending);
  assert.equal(emails.length, 2, 'event reminders are WhatsApp-only');
  assert.deepEqual(whatsapp.slice(-2), ['event_morning', 'event_evening']);
});

test('retry discards a previously queued payment-confirmation email without sending a third email', async () => {
  const updates = [];
  let sent = false;
  const email = loadModule('../lib/email-notifications.ts', {
    'cloudflare:workers': { env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'orders@example.com' } },
    './store': { ensureSchema: async () => {}, db: () => ({ prepare(sql) {
      return {
        bind() { return this; },
        async run() { updates.push(sql); return { meta: { changes: 1 } }; },
        async all() { return { results: [{ id: 'legacy' }] }; },
        async first() { return { id: 'legacy', event: 'paid' }; },
      };
    } }) },
    './evolution-notifications': {},
    './notification-queue': { ...queue, ensureNotificationSchema: async () => {} },
  }, { Date, console, fetch: async () => { sent = true; throw Error('Should not send'); } });
  await email.retryEmailNotifications();
  assert.equal(sent, false);
  assert.ok(updates.some(sql => sql.includes("event NOT IN ('pix_available','completed')")));
  assert.ok(updates.some(sql => sql.includes("state='superseded'") && sql.includes('WHERE id=?')));
});
