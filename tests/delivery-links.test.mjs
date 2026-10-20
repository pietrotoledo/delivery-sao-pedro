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
const { addressWithNeighborhood, deliveryDestination } = context.exports;

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
