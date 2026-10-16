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

test('six order stages schedule six WhatsApp notices but only Pix and thank-you emails', async () => {
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
    './store': { db: () => database, ensureSchema: async () => {}, getOrder: async () => ({ id: 'order', email: 'customer@example.com', status: 'awaiting_payment' }) },
    './evolution-notifications': { orderNoticeMessage: (_, event) => `message:${event}` },
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
  assert.deepEqual(emails.map(x => x.text), ['message:pix_available', 'message:completed']);
  assert.match(emails[1].subject, /Obrigado pela compra!/);
});

test('retry discards a previously queued intermediate email without sending it', async () => {
  const updates = [];
  let sent = false;
  const email = loadModule('../lib/email-notifications.ts', {
    'cloudflare:workers': { env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'orders@example.com' } },
    './store': { ensureSchema: async () => {}, db: () => ({ prepare(sql) {
      return {
        bind() { return this; },
        async run() { updates.push(sql); return { meta: { changes: 1 } }; },
        async all() { return { results: [{ id: 'legacy' }] }; },
        async first() { return { id: 'legacy', event: 'preparing' }; },
      };
    } }) },
    './evolution-notifications': {},
  }, { Date, console, fetch: async () => { sent = true; throw Error('Should not send'); } });
  await email.retryEmailNotifications();
  assert.equal(sent, false);
  assert.ok(updates.some(sql => sql.includes("event NOT IN ('pix_available','completed')")));
  assert.ok(updates.some(sql => sql.includes("state='superseded'") && sql.includes('WHERE id=?')));
});
