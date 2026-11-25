import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {}, require: () => ({ eventLocation: { name: 'Evidence Class Club', address: 'Endereço de retirada' } }) };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/event-schedule.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { dueEventReminder, eventReminderActive, eventReminderText, orderEventSchedule } = context.exports;

test('a single reminder starts at 11h in João Pessoa and expires at 14h', () => {
  const cases = [
    ['2026-12-03T13:59:59Z', null],
    ['2026-12-03T14:00:00Z', 'event_morning'],
    ['2026-12-03T16:59:59Z', 'event_morning'],
    ['2026-12-03T17:00:00Z', null],
    ['2026-12-03T21:00:00Z', null],
    ['2026-10-29T14:00:00Z', null],
    ['2026-10-31T14:00:00Z', null],
    ['2027-12-03T14:00:00Z', null],
  ];
  for (const [date, expected] of cases) assert.equal(dueEventReminder(new Date(date))?.event ?? null, expected, date);
  assert.equal(eventReminderActive('event_morning', new Date('2026-12-03T21:00:00Z')), false);
});

test('messages distinguish delivery start from pickup hours and include the event date', () => {
  for (const event of ['event_morning', 'event_evening']) {
    const delivery = eventReminderText('delivery', event);
    assert.match(delivery, /3 de dezembro/);
    assert.match(delivery, /entregas começam às 19h/);
    assert.match(delivery, /início do delivery/);
    const pickup = eventReminderText('pickup', event);
    assert.match(pickup, /18h às 22h/);
    assert.match(pickup, /Evidence Class Club/);
    assert.doesNotMatch(pickup, /entregas começam/);
  }
  assert.match(orderEventSchedule('delivery'), /3 de dezembro de 2026/);
  assert.match(orderEventSchedule('pickup'), /18h às 22h/);
});

test('outro dia de vendas aberto no painel muda a data das mensagens e do lembrete', () => {
  assert.match(eventReminderText('delivery', 'event_morning', '2026-12-10'), /nesta quinta-feira, 10 de dezembro/);
  assert.match(orderEventSchedule('pickup', '2026-12-12'), /12 de dezembro de 2026/);
  assert.equal(dueEventReminder(new Date('2026-12-10T14:30:00Z'), '2026-12-10')?.event, 'event_morning');
  assert.equal(dueEventReminder(new Date('2026-12-10T14:30:00Z')), null);
});
