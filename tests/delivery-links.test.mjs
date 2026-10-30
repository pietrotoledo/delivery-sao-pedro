import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as deliveryAreas from '../lib/delivery-areas.ts';

const context = { exports: {}, URLSearchParams, require: name => name === './delivery-areas' ? deliveryAreas : { eventLocation: { address: 'Retirada' }, eventLocationMapUrl: 'https://maps' } };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/delivery-links.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { addressWithNeighborhood, deliveryDestination, deliveryWhatsappHref } = context.exports;

test('Endereço mostra o bairro uma única vez', () => {
  assert.equal(addressWithNeighborhood('Rua Teste, 159 · Bancários · João Pessoa - PB', 'Bancários'), 'Rua Teste, 159 · Bancários · João Pessoa - PB');
  assert.equal(addressWithNeighborhood('Rua Teste, 159', 'Bessa'), 'Rua Teste, 159 · Bessa');
  assert.equal(addressWithNeighborhood(null, 'Bessa'), 'Bessa');
});

test('Rota não repete bairro e usa Cabedelo para Intermares', () => {
  assert.equal(deliveryDestination('Rua Teste, 159 · Bancários · João Pessoa - PB · Referência: praça', 'Bancários'), 'Rua Teste, 159, Bancários, João Pessoa - PB');
  assert.equal(deliveryDestination('Rua Teste, 159', 'Intermares'), 'Rua Teste, 159, Intermares, Cabedelo, PB');
  assert.equal(deliveryDestination('Rua Teste, 159', 'Bessa'), 'Rua Teste, 159, Bessa, João Pessoa, PB');
});

test('WhatsApp abre o cliente com DDI, nome do entregador e código do pedido', () => {
  for (const phone of ['(83) 99912-3456', '+55 83 99912-3456']) {
    const url = new URL(deliveryWhatsappHref(phone, 'abcd1234-resto', 'João & Ana'));
    assert.equal(url.pathname, '/5583999123456');
    assert.match(url.searchParams.get('text'), /João & Ana/);
    assert.match(url.searchParams.get('text'), /#ABCD1234/);
  }
  assert.match(new URL(deliveryWhatsappHref('5583999123456', 'abcd1234')).searchParams.get('text'), /equipe de entregas/);
  assert.equal(deliveryWhatsappHref('', 'abcd1234'), null);
  assert.equal(deliveryWhatsappHref('123', 'abcd1234'), null);
});
