import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { deliveryAreas, deliveryFeeFor } from "../lib/delivery-areas.ts";
import { includesBurger, hamburgerIngredients, comboDrinkOptions } from "../lib/menu-options.ts";

const require = createRequire(import.meta.url);
const route = ts.transpileModule(readFileSync(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function orderApi() {
  let inserted;
  let paymentAttempts = 0;
  const database = {
    prepare(sql) {
      return { sql, bind(...args) { this.args = args; return this; }, async first() { return null; } };
    },
    async batch(statements) { inserted = statements[0].args; return [{ meta: { changes: 1 } }]; },
  };
  const store = {
    sameOrigin: () => true, ensureSchema: async () => {}, db: () => database,
    config: async () => ({ paused: false }),
    getProducts: async () => [
      { id: "classic", name: "Classic", category: "burger", price: 1000, stock: null, ingredients: hamburgerIngredients },
      { id: "combo", name: "Combo", category: "combo", price: 1500, stock: null, ingredients: hamburgerIngredients },
      { id: "fries-small", name: "Batata frita individual", category: "side", price: 500, stock: null, ingredients: [] },
    ],
    getOrder: async () => ({ total: inserted[16], delivery_fee: inserted[15] }),
    paymentHandle: () => "test",
    json: (body, status = 200) => Response.json(body, { status }),
  };
  const context = {
    exports: {}, crypto: webcrypto, TextEncoder, URL,
    require(name) {
      if (name === "@/lib/store") return store;
      if (name === "@/lib/delivery-areas") return { deliveryFeeFor };
      if (name === "@/lib/menu-options") return { includesBurger, comboDrinkOptions };
      if (name === "@/lib/evolution-notifications") return { evolutionEnabled: () => false };
      if (name === "@/lib/payment") return { createCheckout: async () => { paymentAttempts++; return { demo: true }; } };
      return require(name);
    },
  };
  vm.runInNewContext(route, context);
  return { post: context.exports.POST, inserted: () => inserted, paymentAttempts: () => paymentAttempts };
}

const payload = (neighborhood, expectedDeliveryFee) => ({
  requestKey: webcrypto.randomUUID(), name: "Cliente Teste", phone: "83999999999", email: "teste@example.com",
  method: "delivery", neighborhood, address: "Rua Teste, 159", items: [{ id: "classic", quantity: 1 }],
  expectedSubtotal: 1000, expectedDeliveryFee,
});
const request = body => new Request("https://example.com/api/orders", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

for (const area of deliveryAreas) {
  test(`Pedido em ${area.name}: taxa ${area.fee} e total correto, pronto para Pix`, async () => {
    const api = orderApi();
    const response = await api.post(request(payload(area.name, area.fee)));
    assert.equal(response.status, 201);
    assert.equal(api.inserted()[15], area.fee);
    assert.equal(api.inserted()[16], 1000 + area.fee);
    assert.equal(api.inserted()[17], "ready_for_payment");
    assert.equal(api.paymentAttempts(), 1);
  });
}

test("Rejeita bairro não atendido e taxa adulterada antes de criar o pedido", async () => {
  for (const [neighborhood, fee, status] of [["Centro", 0, 400], ["Bessa", 0, 409]]) {
    const api = orderApi();
    assert.equal((await api.post(request(payload(neighborhood, fee)))).status, status);
    assert.equal(api.inserted(), undefined);
    assert.equal(api.paymentAttempts(), 0);
  }
});

test("Retirada permanece sem taxa e pronta para Pix", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Bessa", 0), method: "pickup" }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[15], 0);
  assert.equal(api.inserted()[16], 1000);
});

test("Combo conta um hambúrguer e salva a personalização", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Manaíra", 0), items: [{ id: "combo", quantity: 2, unitRemovals: [["Maionese"], []], unitDrinks: ["Coca-Cola normal", "Guaraná"] }], expectedSubtotal: 3000 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[13], 2);
  assert.deepEqual(JSON.parse(api.inserted()[12])[0].unitDrinks, ["Coca-Cola normal", "Guaraná"]);
  assert.deepEqual(JSON.parse(api.inserted()[12])[0].unitRemovals, [["Maionese"], []]);
});

test("Permite batata individual e impede pedido vazio", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Bessa", 500), items: [{ id: "fries-small", quantity: 1 }], expectedSubtotal: 500 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[13], 0);
  assert.equal(api.inserted()[16], 1000);
  const empty = orderApi();
  assert.equal((await empty.post(request({ ...payload("Manaíra", 0), items: [], expectedSubtotal: 0 }))).status, 400);
  assert.equal(empty.inserted(), undefined);
});

test("Rejeita combo com ingredientes antigos e mais de 20 hambúrgueres", async () => {
  for (const items of [
    [{ id: "combo", quantity: 1, unitRemovals: [["Alface"]] }],
    [{ id: "classic", quantity: 11 }, { id: "combo", quantity: 10 }],
  ]) {
    const api = orderApi();
    assert.equal((await api.post(request({ ...payload("Manaíra", 0), items }))).status, 400);
    assert.equal(api.inserted(), undefined);
  }
});

test("Rejeita combo sem refrigerante ou com bebida fora das opcoes", async () => {
  for (const unitDrinks of [[], ["Água mineral"], ["Outra bebida"]]) {
    const api = orderApi();
    const response = await api.post(request({...payload("Manaíra", 0), items: [{id: "combo", quantity: 1, unitDrinks}], expectedSubtotal: 1500}));
    assert.equal(response.status, 400);
    assert.equal(api.inserted(), undefined);
  }
});
