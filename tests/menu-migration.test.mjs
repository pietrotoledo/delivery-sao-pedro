import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as menuOptions from "../lib/menu-options.ts";
import { orderItemLabels } from "../lib/order-item-labels.ts";

const storeSource = ts.transpileModule(readFileSync(new URL("../lib/store.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("Atualiza banco existente com o cardápio aprovado uma única vez", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE products(id text PRIMARY KEY,name text NOT NULL,description text NOT NULL,
    category text NOT NULL,price integer NOT NULL,image_url text,stock integer,active integer NOT NULL DEFAULT 1,
    sort_order integer NOT NULL DEFAULT 0,ingredients_json text NOT NULL DEFAULT '[]',created_at text NOT NULL,updated_at text NOT NULL);
    INSERT INTO products(id,name,description,category,price,stock,created_at,updated_at) VALUES
    ('classic','Antigo','Receita antiga','burger',2200,7,'x','x'),
    ('fries-large','Batata grande','Antiga','side',1200,NULL,'x','x'),
    ('water','Água','Antiga','drink',350,NULL,'x','x');`);
  const database = {
    prepare(sql) {
      return {
        bind(...args) { this.args = args; return this; },
        async run() { const result = sqlite.prepare(sql).run(...(this.args ?? [])); return { meta: { changes: Number(result.changes) } }; },
        async all() { return { results: sqlite.prepare(sql).all(...(this.args ?? [])) }; },
        async first() { return sqlite.prepare(sql).get(...(this.args ?? [])) ?? null; },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT"); return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  function loadStore() {
    const context = { exports: {}, require(name) {
      if (name === "cloudflare:workers") return { env: { DB: database } };
      if (name === "./menu-options") return menuOptions;
      throw new Error(name);
    } };
    vm.runInNewContext(storeSource, context);
    return context.exports;
  }
  try {
    const store = loadStore();
    await store.ensureSchema();
    const products = sqlite.prepare("SELECT * FROM products WHERE active=1 ORDER BY sort_order").all();
    assert.deepEqual(products.map(product => [product.id, product.price]), [
      ["classic", 2500], ["combo", 3500], ["fries-small", 800], ["coke", 600], ["coke-zero", 600], ["guarana", 600], ["water", 300],
    ]);
    assert.equal(products.filter(product => product.category === "burger").length, 1);
    for (const product of products.filter(menuOptions.includesBurger)) assert.deepEqual(JSON.parse(product.ingredients_json), menuOptions.hamburgerIngredients);
    assert.equal(products.find(product => product.id === "combo").image_url, "/products/combo-azul-v2.webp");
    assert.ok(products.filter(product => product.id !== "combo").every(product => product.image_url === null));
    assert.equal(products[0].stock, 7);
    assert.equal(sqlite.prepare("SELECT active FROM products WHERE id='fries-large'").get().active, 0);
    const oldItem = store.orderItems({items_json: JSON.stringify([{id: "classic", quantity: 1, name: "Pedido antigo", price: 2200}])})[0];
    assert.equal(oldItem.price, 2200);
    assert.equal(oldItem.name, "Pedido antigo");
    sqlite.exec("UPDATE products SET price=2600 WHERE id='classic'");
    sqlite.exec("UPDATE products SET image_url=NULL WHERE id='combo'; DELETE FROM menu_revisions WHERE id='combo-photo-2026-10-v1'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT price FROM products WHERE id='classic'").get().price, 2600);
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='combo'").get().image_url, "/products/combo-azul-v2.webp");
    sqlite.exec("UPDATE products SET image_url='/products/custom.webp' WHERE id='combo'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='combo'").get().image_url, "/products/custom.webp");
  } finally { sqlite.close(); }
});

test("Pedido mostra o refrigerante e a personalização de cada combo", () => {
  const labels = orderItemLabels({name: "Combo da noite", quantity: 2, unitRemovals: [["Maionese"], []], unitDrinks: ["Guaraná", "Coca-Cola Zero"]});
  assert.match(labels[0], /sem maionese.*Guaraná/);
  assert.match(labels[1], /completo.*Coca-Cola Zero/);
});
