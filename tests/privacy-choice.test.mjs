import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function orderApi() {
  let inserted;
  const database = {
    prepare(sql) {
      return { bind(...args) { if (sql.startsWith('INSERT')) inserted = args; return this; }, async first() { return null; } };
    },
    async batch() { return [{ meta: { changes: 1 } }]; },
  };
  const imports = {
    '@/lib/menu-options': { availableComboDrinks: () => [], comboDrinkOptions: [], includesBurger: product => product.category === 'burger' },
    '@/lib/delivery-areas': { deliveryFeeFor: () => 0 },
    '@/lib/delivery-address': {},
    '@/lib/payment': {},
    '@/lib/stock': { releaseExpiredOrders: async () => 0, burgerAvailability: async () => ({ left: 100 }) },
    '@/lib/stock-rules': { reservedBurgersSql: '0', capacitySql: '100' },
    '@/lib/phone': { normalizeBrazilianMobile: () => '5583999123456' },
    '@/lib/store': {
      sameOrigin: () => true, json: (body, status = 200) => Response.json(body, { status }),
      ensureSchema: async () => {}, config: async () => ({ paused: false }), db: () => database,
      paymentHandle: () => '',
      getProducts: async () => [{ id: 'classic', name: 'Burger', price: 2500, category: 'burger', ingredients: [], stock: null }],
    },
  };
  const context = { exports: {}, require: key => imports[key], crypto: globalThis.crypto, TextEncoder };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { post: context.exports.POST, inserted: () => inserted };
}

for (const [choice, expected] of [[undefined, 400], [false, 400], [true, 201], ['true', 400]]) {
  test(`pedido exige autorização WhatsApp: ${String(choice)} responde ${expected}`, async () => {
    const api = orderApi();
    const response = await api.post(new Request('https://example.com/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestKey: crypto.randomUUID(), name: 'Maria Silva', phone: '83999123456', email: 'maria@example.com',
        method: 'pickup', items: [{ id: 'classic', quantity: 1 }], expectedSubtotal: 2500, expectedDeliveryFee: 0, whatsappOptIn: choice }),
    }));
    assert.equal(response.status, expected, JSON.stringify(await response.json()));
    assert.equal(api.inserted()?.[18], expected === 201 ? 1 : undefined);
  });
}
