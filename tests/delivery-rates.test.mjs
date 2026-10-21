import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import * as deliveryAreasModule from "../lib/delivery-areas.ts";
const { deliveryAreas, deliveryFeeFor } = deliveryAreasModule;
import { availableComboDrinks, includesBurger, hamburgerIngredients, comboDrinkOptions } from "../lib/menu-options.ts";
import * as phoneHelpers from "../lib/phone.ts";

const require = createRequire(import.meta.url);
const addressContext = { exports: {}, fetch, require: () => deliveryAreasModule };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/delivery-address.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, addressContext);
const stockRules = { exports: {}, require: () => ({ comboDrinkProductId: value => ({ "Coca-Cola normal": "coke", "Coca-Cola Zero": "coke-zero", "Guaraná": "guarana", "Água com gás": "sparkling-water" })[value] }) };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/stock-rules.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, stockRules);
const route = ts.transpileModule(readFileSync(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function orderApi(productChanges = {}, burgersLeft = 100) {
  let savedStatements = [];
  let inserted;
  let paymentAttempts = 0;
  const database = {
    prepare(sql) {
      return { sql, bind(...args) { this.args = args; return this; }, async first() { return null; } };
    },
    async batch(statements) { savedStatements = statements; inserted = statements[0].args; return [{ meta: { changes: 1 } }]; },
  };
  const store = {
    sameOrigin: () => true, ensureSchema: async () => {}, db: () => database,
    config: async () => ({ paused: false }),
    getProducts: async () => [
      { id: "classic", name: "Classic", category: "burger", price: 1000, stock: null, ingredients: hamburgerIngredients },
      { id: "combo", name: "Combo", category: "combo", price: 1500, stock: null, ingredients: hamburgerIngredients },
      { id: "fries-small", name: "Batata frita individual", category: "side", price: 500, stock: null, ingredients: [] },
      { id: "sweets-kit", name: "Kit com 4 docinhos", category: "side", price: 700, stock: null, ingredients: [] },
      { id: "coke", name: "Coca-Cola normal", category: "drink", price: 600, stock: null, ingredients: [] },
      { id: "coke-zero", name: "Coca-Cola Zero", category: "drink", price: 600, stock: null, ingredients: [] },
      { id: "guarana", name: "Guaran\u00e1", category: "drink", price: 600, stock: null, ingredients: [] },
      { id: "sparkling-water", name: "\u00c1gua com g\u00e1s", category: "drink", price: 400, stock: null, ingredients: [] },
    ].map(product => ({ ...product, ...productChanges[product.id] })).filter(product => product.active !== false),
    getOrder: async () => ({ total: inserted[16], delivery_fee: inserted[15] }),
    paymentHandle: () => "test",
    json: (body, status = 200) => Response.json(body, { status }),
  };
  const context = {
    exports: {}, crypto: webcrypto, TextEncoder, URL,
    require(name) {
      if (name === "@/lib/store") return store;
      if (name === "@/lib/delivery-areas") return { deliveryFeeFor };
      if (name === "@/lib/delivery-address") return addressContext.exports;
      if (name === "@/lib/menu-options") return { availableComboDrinks, includesBurger, comboDrinkOptions };
      if (name === "@/lib/phone") return phoneHelpers;
      if (name === "@/lib/evolution-notifications") return { evolutionEnabled: () => false };
      if (name === "@/lib/stock") return { releaseExpiredOrders: async () => 0, burgerAvailability: async () => ({ reserved: 100 - burgersLeft, capacity: 100, left: burgersLeft }) };
      if (name === "@/lib/stock-rules") return stockRules.exports;
      if (name === "@/lib/payment") return { createCheckout: async () => { paymentAttempts++; return { demo: true }; } };
      return require(name);
    },
  };
  vm.runInNewContext(route, context);
  return { post: context.exports.POST, inserted: () => inserted, statements: () => savedStatements, paymentAttempts: () => paymentAttempts };
}

const payload = (neighborhood, expectedDeliveryFee) => ({
  requestKey: webcrypto.randomUUID(), name: "Cliente Teste", phone: "83999123456", email: "teste@example.com", whatsappOptIn: true,
  method: "delivery", neighborhood, address: "Rua Teste, 159", items: [{ id: "classic", quantity: 1 }],
  expectedSubtotal: 1000, expectedDeliveryFee,
});
const request = body => new Request("https://example.com/api/orders", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("Exige autorização explícita de WhatsApp antes de reservar estoque ou gerar pagamento", async () => {
  for (const value of [undefined, false, null, 1, "true"]) {
    const api = orderApi();
    const response = await api.post(request({ ...payload("Miramar", 500), whatsappOptIn: value }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /WhatsApp/);
    assert.equal(api.inserted(), undefined);
    assert.equal(api.paymentAttempts(), 0);
  }
});

test("Preserva a autorização mesmo quando a integração está temporariamente desconfigurada", async () => {
  const api = orderApi();
  const response = await api.post(request(payload("Miramar", 500)));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[18], 1);
});

for (const area of deliveryAreas) {
  const fee = area.fee === "combinar" ? null : area.fee;
  test(`Pedido em ${area.name}: taxa ${area.fee} e total correto, pronto para Pix`, async () => {
    const api = orderApi();
    const deliveryAddress = { ...addressContext.exports.emptyDeliveryAddress, street: "Rua Teste", number: "159", neighborhood: area.name, city: area.city ?? "João Pessoa" };
    const response = await api.post(request({ ...payload(area.name, fee), deliveryAddress }));
    assert.equal(response.status, 201);
    assert.equal(api.inserted()[15], fee);
    assert.equal(api.inserted()[16], 1000 + (fee ?? 0));
    assert.equal(api.inserted()[17], "ready_for_payment");
    assert.equal(api.paymentAttempts(), 1);
  });
}

test("Rejeita bairro não atendido e taxa adulterada antes de criar o pedido", async () => {
  for (const [neighborhood, fee, status] of [["Centro", 0, 400], ["Pedro Gondim", 0, 409], ["Miramar", 0, 409], ["Brisamar", 0, 409]]) {
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

test("Salva endereço estruturado completo e calcula a taxa pelo bairro estruturado", async () => {
  const api = orderApi();
  const deliveryAddress = { ...addressContext.exports.emptyDeliveryAddress, cep: "58037-000", street: "Rua Teste", number: "159", complement: "Apto. 10", reference: "Portaria azul", neighborhood: "Altiplano" };
  const response = await api.post(request({ ...payload("Manaíra", 500), address: "Ignorar texto adulterado", deliveryAddress }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[9], "Altiplano");
  assert.equal(api.inserted()[10], addressContext.exports.formatDeliveryAddress(deliveryAddress));
  assert.equal(api.inserted()[15], 500);
});

test("Rejeita endereço estruturado incompleto e fora de João Pessoa antes de cobrar", async () => {
  const valid = { ...addressContext.exports.emptyDeliveryAddress, street: "Rua Teste", number: "159", neighborhood: "Altiplano" };
  for (const deliveryAddress of [null, {}, { ...valid, city: "Cabedelo" }, { ...valid, state: "PE" }, { ...valid, neighborhood: "Centro" }, { ...valid, number: "" }, { ...valid, cep: "123" }]) {
    const api = orderApi();
    const response = await api.post(request({ ...payload("Altiplano", 500), deliveryAddress }));
    assert.equal(response.status, 400);
    assert.equal(api.inserted(), undefined);
    assert.equal(api.paymentAttempts(), 0);
  }
});

test("Combo conta um hambúrguer e salva a personalização", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Manaíra", 0), items: [{ id: "combo", quantity: 2, unitRemovals: [["Maionese"], []], unitDrinks: ["Coca-Cola normal", "Guaraná"] }], expectedSubtotal: 3000 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[13], 2);
  assert.deepEqual(JSON.parse(api.inserted()[12])[0].unitDrinks, ["Coca-Cola normal", "Guaraná"]);
  assert.deepEqual(JSON.parse(api.inserted()[12])[0].unitRemovals, [["Maionese"], []]);
});

test("Rejeita acompanhamentos sem hamburguer antes de reservar estoque ou gerar pagamento", async () => {
  for (const items of [
    [{ id: "fries-small", quantity: 1 }],
    [{ id: "sweets-kit", quantity: 1 }],
    [{ id: "coke", quantity: 1 }],
    [{ id: "fries-small", quantity: 1 }, { id: "sweets-kit", quantity: 1 }, { id: "sparkling-water", quantity: 1 }],
    [{ id: "classic", quantity: 0 }, { id: "coke", quantity: 1 }],
  ]) {
    const api = orderApi();
    const response = await api.post(request({ ...payload("Manaíra", 0), items, expectedSubtotal: 0 }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /pelo menos um hambúrguer/);
    assert.equal(api.inserted(), undefined);
    assert.equal(api.statements().length, 0);
    assert.equal(api.paymentAttempts(), 0);
  }
});

test("Permite batata com hamburguer e impede pedido vazio", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Altiplano", 500), items: [{ id: "classic", quantity: 1 }, { id: "fries-small", quantity: 1 }], expectedSubtotal: 1500 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[13], 1);
  assert.equal(api.inserted()[16], 2000);
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

test("Kit de 4 docinhos acompanha hamburguer e Miramar cobra R$ 5", async () => {
  const api = orderApi();
  const response = await api.post(request({ ...payload("Miramar", 500), items: [{ id: "sweets-kit", quantity: 2 }, { id: "classic", quantity: 1 }], expectedSubtotal: 2400 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[13], 1);
  assert.equal(api.inserted()[15], 500);
  assert.equal(api.inserted()[16], 2900);
  const [item] = JSON.parse(api.inserted()[12]);
  assert.equal(item.name, "Kit com 4 docinhos");
  assert.equal(item.quantity, 2);
  assert.equal(item.price, 700);
});

test("API aceita as quatro bebidas renomeadas sem cobrar novamente a bebida incluida", async () => {
  const api = orderApi({ coke: { name: "Coca-Cola" }, "coke-zero": { name: "Coca Zero" }, guarana: { name: "Guarana Antarctica" } });
  const response = await api.post(request({ ...payload("Manaíra", 0), items: [{ id: "combo", quantity: 4, unitDrinks: comboDrinkOptions }], expectedSubtotal: 6000 }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[16], 6000);
  assert.deepEqual(JSON.parse(api.inserted()[12])[0].unitDrinks, comboDrinkOptions);
  assert.deepEqual(Array.from(api.statements().slice(1), statement => [statement.args[2], statement.args[0]]), [
    ["combo", 4], ["coke", 1], ["coke-zero", 1], ["guarana", 1], ["sparkling-water", 1],
  ]);
});

test("API recusa bebida esgotada, inativa ou com quantidade insuficiente para os combos", async () => {
  for (const changes of [{ stock: 0 }, { active: false }, { category: "side" }, { stock: 1 }]) {
    const api = orderApi({ coke: changes });
    const response = await api.post(request({ ...payload("Manaíra", 0), items: [{ id: "combo", quantity: 2, unitDrinks: ["Coca-Cola normal", "Coca-Cola normal"] }], expectedSubtotal: 3000 }));
    assert.equal(response.status, 409);
    assert.equal(api.inserted(), undefined);
    assert.equal(api.paymentAttempts(), 0);
  }
});

test("Bebida avulsa e incluida no combo compartilham o mesmo estoque", async () => {
  const body = { ...payload("Miramar", 500), items: [{ id: "combo", quantity: 1, unitDrinks: ["Coca-Cola normal"] }, { id: "coke", quantity: 1 }], expectedSubtotal: 2100 };
  const unavailable = orderApi({ coke: { stock: 1 } });
  assert.equal((await unavailable.post(request(body))).status, 409);
  const api = orderApi({ coke: { stock: 2 } });
  assert.equal((await api.post(request(body))).status, 201);
  assert.equal(api.inserted()[16], 2600);
  const update = api.statements().filter(statement => statement.args[2] === "coke");
  assert.equal(update.length, 1);
  assert.equal(update[0].args[0], 2);

  // Execute the actual reservation SQL, then simulate a second stale request.
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,active INTEGER,stock INTEGER,updated_at TEXT);
      INSERT INTO products VALUES ('combo',1,5,'x'),('coke',1,2,'x');
      CREATE TABLE orders(id TEXT PRIMARY KEY,request_key TEXT UNIQUE,request_hash TEXT,created_at TEXT,updated_at TEXT,
        name TEXT,phone TEXT,email TEXT,method TEXT,neighborhood TEXT,address TEXT,notes TEXT,items_json TEXT,
        burger_count INTEGER,subtotal INTEGER,delivery_fee INTEGER,total INTEGER,status TEXT,whatsapp_opt_in INTEGER);
      CREATE TABLE settings(id INTEGER PRIMARY KEY,capacity INTEGER,paused INTEGER);`);
    sqlite.exec("BEGIN");
    for (const statement of api.statements()) sqlite.prepare(statement.sql).run(...statement.args);
    sqlite.exec("COMMIT");
    assert.equal(sqlite.prepare("SELECT stock FROM products WHERE id='coke'").get().stock, 0);
    assert.equal(sqlite.prepare("SELECT stock FROM products WHERE id='combo'").get().stock, 4);
    assert.equal(sqlite.prepare("SELECT total FROM orders").get().total, 2600);
    const oldId = api.inserted()[0];
    const newId = webcrypto.randomUUID();
    const secondRequest = webcrypto.randomUUID();
    sqlite.exec("BEGIN");
    for (const [index, statement] of api.statements().entries()) {
      const args = statement.args.map(value => value === oldId ? newId : value);
      if (index === 0) args[1] = secondRequest;
      sqlite.prepare(statement.sql).run(...args);
    }
    sqlite.exec("COMMIT");
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
    assert.equal(sqlite.prepare("SELECT stock FROM products WHERE id='coke'").get().stock, 0);
    assert.equal(sqlite.prepare("SELECT stock FROM products WHERE id='combo'").get().stock, 4);
  } finally { sqlite.close(); }
});

test("Brisamar aceita endereço estruturado e soma R$ 5 ao total do Pix", async () => {
  const api = orderApi();
  const deliveryAddress = { ...addressContext.exports.emptyDeliveryAddress, street: "Rua Teste", number: "159", neighborhood: "Brisamar" };
  const response = await api.post(request({ ...payload("Manaíra", 500), deliveryAddress }));
  assert.equal(response.status, 201);
  assert.equal(api.inserted()[9], "Brisamar");
  assert.match(api.inserted()[10], /Brisamar/);
  assert.equal(api.inserted()[15], 500);
  assert.equal(api.inserted()[16], 1500);
  assert.equal(api.paymentAttempts(), 1);
});

test("Novas regras: frete grátis nos bairros da orla e R$ 5 nos demais, grátis acima de R$ 60", () => {
  for (const name of ["Manaíra", "Bessa", "Aeroclube", "Tambaú", "Jardim Oceania"]) assert.equal(deliveryFeeFor(name, 1000), 0);
  for (const name of ["Bairro dos Estados", "Cabo Branco", "Pedro Gondim", "Tambauzinho", "Miramar", "Brisamar", "Altiplano"]) {
    assert.equal(deliveryFeeFor(name, 6000), 500);
    assert.equal(deliveryFeeFor(name, 6001), 0);
  }
  assert.equal(deliveryFeeFor("Centro", 9000), null);
});

test("Pedido acima de R$ 60 em bairro com taxa sai com frete grátis e recusa taxa antiga", async () => {
  const body = { ...payload("Miramar", 0), items: [{ id: "classic", quantity: 7 }], expectedSubtotal: 7000 };
  const api = orderApi();
  assert.equal((await api.post(request(body))).status, 201);
  assert.equal(api.inserted()[15], 0);
  assert.equal(api.inserted()[16], 7000);
  const stale = orderApi();
  assert.equal((await stale.post(request({ ...body, requestKey: webcrypto.randomUUID(), expectedDeliveryFee: 500 }))).status, 409);
});

test("Bancários, Portal do Sol e Intermares: taxa a combinar no WhatsApp, fora do Pix, e grátis acima de R$ 60", async () => {
  for (const name of ["Bancários", "Portal do Sol", "Intermares"]) {
    assert.equal(deliveryFeeFor(name, 6000), "combinar");
    assert.equal(deliveryFeeFor(name, 6001), 0);
  }
  const intermares = { ...addressContext.exports.emptyDeliveryAddress, street: "Rua Teste", number: "159", neighborhood: "Intermares", city: "Cabedelo" };
  assert.equal(addressContext.exports.deliveryAddressError(intermares), null);
  assert.ok(addressContext.exports.deliveryAddressError({ ...intermares, city: "João Pessoa" }));
  assert.ok(addressContext.exports.deliveryAddressError({ ...intermares, neighborhood: "Bessa" }));
  const api = orderApi();
  assert.equal((await api.post(request({ ...payload("Intermares", null), deliveryAddress: intermares }))).status, 201);
  assert.equal(api.inserted()[15], null);
  assert.equal(api.inserted()[16], 1000);
  const stale = orderApi();
  assert.equal((await stale.post(request({ ...payload("Portal do Sol", 0) }))).status, 409);
  const free = orderApi();
  assert.equal((await free.post(request({ ...payload("Bancários", 0), items: [{ id: "classic", quantity: 7 }], expectedSubtotal: 7000 }))).status, 201);
  assert.equal(free.inserted()[15], 0);
});


test("Limite de hambúrgueres: recusa pedido acima do que resta, antes de reservar ou cobrar", async () => {
  const api = orderApi({}, 2);
  const response = await api.post(request({ ...payload("Manaíra", 0), items: [{ id: "classic", quantity: 3 }], expectedSubtotal: 3000 }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Restam apenas 2 hambúrgueres disponíveis/);
  assert.equal(api.inserted(), undefined);
  assert.equal(api.paymentAttempts(), 0);
  const soldOut = orderApi({}, 0);
  const closed = await soldOut.post(request(payload("Manaíra", 0)));
  assert.equal(closed.status, 409);
  assert.match((await closed.json()).error, /esgotaram/);
  const ok = orderApi({}, 1);
  assert.equal((await ok.post(request(payload("Manaíra", 0)))).status, 201);
});

test("Limite de hambúrgueres no banco: dois pedidos simultâneos não passam do limite", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,active INTEGER,stock INTEGER,updated_at TEXT);
      INSERT INTO products VALUES ('classic',1,NULL,'x');
      CREATE TABLE orders(id TEXT PRIMARY KEY,request_key TEXT UNIQUE,request_hash TEXT,created_at TEXT,updated_at TEXT,
        name TEXT,phone TEXT,email TEXT,method TEXT,neighborhood TEXT,address TEXT,notes TEXT,items_json TEXT,
        burger_count INTEGER,subtotal INTEGER,delivery_fee INTEGER,total INTEGER,status TEXT,whatsapp_opt_in INTEGER);
      CREATE TABLE settings(id INTEGER PRIMARY KEY,capacity INTEGER,paused INTEGER);
      INSERT INTO settings VALUES (1,5,0);
      INSERT INTO orders (id,burger_count,status) VALUES ('pago',2,'paid'),('aguardando',2,'awaiting_payment'),('expirado',9,'expired'),('devolvido',9,'refunded');`);
    // Os dois pedidos foram aceitos pela checagem prévia (resta 1), mas só o primeiro grava.
    const first = orderApi({}, 1); await first.post(request(payload("Manaíra", 0)));
    const second = orderApi({}, 1); await second.post(request(payload("Manaíra", 0)));
    for (const api of [first, second]) for (const statement of api.statements()) sqlite.prepare(statement.sql).run(...statement.args);
    assert.equal(sqlite.prepare("SELECT SUM(burger_count) AS n FROM orders WHERE status NOT IN ('expired','refunded')").get().n, 5);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM orders WHERE name='Cliente Teste'").get().n, 1);
  } finally { sqlite.close(); }
});

test("Estoque conta bebidas dos combos", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(stockRules.exports.stockRequirements([{ id: "combo", quantity: 2, unitDrinks: ["Coca-Cola normal", "Guaraná"] }, { id: "coke", quantity: 1 }]))),
    [{ id: "combo", quantity: 2 }, { id: "coke", quantity: 2 }, { id: "guarana", quantity: 1 }]);
});
