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
      ["classic", 2500], ["combo", 3500], ["fries-small", 800], ["coke", 600], ["coke-zero", 600], ["guarana", 600], ["water", 300], ["sparkling-water", 400], ["sweets-kit", 700],
    ]);
    assert.equal(products.filter(product => product.category === "burger").length, 1);
    assert.equal(products.find(product => product.id === "classic").name, "Blueck Burguer");
    assert.equal(products.find(product => product.id === "combo").name, "Blueck Combo");
    for (const product of products.filter(menuOptions.includesBurger)) assert.deepEqual(JSON.parse(product.ingredients_json), menuOptions.hamburgerIngredients);
    assert.equal(products.find(product => product.id === "combo").image_url, "/products/combo-azul-v2.webp");
    assert.deepEqual(products.map(product => [product.id, product.image_url]), [
      ["classic", "/products/hamburguer-solo-azul.webp"], ["combo", "/products/combo-azul-v2.webp"], ["fries-small", "/products/batata-azul.webp"],
      ["coke", "/products/coca-original-azul.webp"], ["coke-zero", "/products/coca-zero-azul.webp"], ["guarana", "/products/guarana-azul.webp"], ["water", "/products/water.webp"], ["sparkling-water", "/products/sparkling-water.png"], ["sweets-kit", "/products/docinhos-nuvens.webp"],
    ]);
    assert.match(products[0].description, /maionese artesanal/);
    assert.equal(products[0].stock, 7);
    assert.equal(sqlite.prepare("SELECT active FROM products WHERE id='fries-large'").get().active, 0);
    const oldItem = store.orderItems({items_json: JSON.stringify([{id: "classic", quantity: 1, name: "Pedido antigo", price: 2200}])})[0];
    assert.equal(oldItem.price, 2200);
    assert.equal(oldItem.name, "Pedido antigo");
    sqlite.exec("UPDATE products SET price=2600 WHERE id='classic'");
    sqlite.exec("UPDATE products SET image_url=NULL WHERE id IN ('classic','combo','fries-small','coke','coke-zero','guarana'); DELETE FROM menu_revisions WHERE id IN ('burger-photo-2026-10-v1','combo-photo-2026-10-v1','product-photos-2026-10-v1')");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT price FROM products WHERE id='classic'").get().price, 2600);
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='classic'").get().image_url, "/products/hamburguer-solo-azul.webp");
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='combo'").get().image_url, "/products/combo-azul-v2.webp");
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='fries-small'").get().image_url, "/products/batata-azul.webp");
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='coke'").get().image_url, "/products/coca-original-azul.webp");
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='coke-zero'").get().image_url, "/products/coca-zero-azul.webp");
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='guarana'").get().image_url, "/products/guarana-azul.webp");
    sqlite.exec("UPDATE products SET image_url='/products/custom.webp' WHERE id='combo'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='combo'").get().image_url, "/products/custom.webp");
    // Simula o banco publicado antes da inclusao dos docinhos.
    sqlite.exec("DELETE FROM products WHERE id='sweets-kit'; DELETE FROM menu_revisions WHERE id='sweets-kit-artisan-mayo-2026-10-v1'");
    sqlite.prepare("UPDATE products SET description=? WHERE id='classic'").run("Carne de 140 g, queijo, cebola caramelizada e maionese.");
    await loadStore().ensureSchema();
    assert.deepEqual({ ...sqlite.prepare("SELECT price,image_url,active,stock FROM products WHERE id='sweets-kit'").get() }, { price: 700, image_url: "/products/docinhos-nuvens.webp", active: 1, stock: null });
    assert.match(sqlite.prepare("SELECT description FROM products WHERE id='classic'").get().description, /maionese artesanal/);
    assert.equal(sqlite.prepare("SELECT price FROM products WHERE id='classic'").get().price, 2600);
    sqlite.exec("UPDATE products SET price=800,stock=3,active=0 WHERE id='sweets-kit'; UPDATE products SET description='Receita editada' WHERE id='classic'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM products WHERE id='sweets-kit'").get().count, 1);
    assert.deepEqual({ ...sqlite.prepare("SELECT price,stock,active FROM products WHERE id='sweets-kit'").get() }, { price: 800, stock: 3, active: 0 });
    assert.equal(sqlite.prepare("SELECT description FROM products WHERE id='classic'").get().description, 'Receita editada');
    // O kit que ja existia sem foto recebe a imagem sem alterar os dados comerciais.
    sqlite.exec("DELETE FROM menu_revisions WHERE id='sweets-kit-cloud-photo-2026-10-v1'; UPDATE products SET image_url=NULL WHERE id='sweets-kit'");
    await loadStore().ensureSchema();
    assert.deepEqual({ ...sqlite.prepare("SELECT image_url,price,stock,active FROM products WHERE id='sweets-kit'").get() }, { image_url: "/products/docinhos-nuvens.webp", price: 800, stock: 3, active: 0 });
    sqlite.exec("UPDATE products SET image_url='/products/custom-sweets.webp' WHERE id='sweets-kit'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='sweets-kit'").get().image_url, "/products/custom-sweets.webp");
    // Atualiza os nomes tambem em um banco ja publicado, preservando preco e estoque.
    sqlite.exec("DELETE FROM menu_revisions WHERE id='blueck-burger-combo-names-2026-10-v1'; UPDATE products SET name='Blueck combo',stock=4 WHERE id='combo'; UPDATE products SET name='Hamburguer artesanal' WHERE id='classic'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT name FROM products WHERE id='classic'").get().name, "Blueck Burguer");
    assert.deepEqual({ ...sqlite.prepare("SELECT name,price,stock FROM products WHERE id='combo'").get() }, { name: "Blueck Combo", price: 3500, stock: 4 });
    sqlite.exec("UPDATE products SET name='Nome editado pela equipe' WHERE id='combo'");
    await loadStore().ensureSchema();
    assert.equal(sqlite.prepare("SELECT name FROM products WHERE id='combo'").get().name, "Nome editado pela equipe");
  } finally { sqlite.close(); }
});

test("Pedido mostra o refrigerante e a personalização de cada combo", () => {
  const labels = orderItemLabels({name: "Combo da noite", quantity: 2, unitRemovals: [["Maionese"], []], unitDrinks: ["Guaraná", "Coca-Cola Zero"]});
  assert.match(labels[0], /sem maionese.*Guaraná/);
  assert.match(labels[1], /completo.*Coca-Cola Zero/);
});
