import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function load(file, modules, globals = {}) {
  const context = { exports: {}, crypto: webcrypto, require: name => modules[name], TextEncoder, ReadableStream, Response, ...globals };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

function setup(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE orders(id TEXT PRIMARY KEY, name TEXT, phone TEXT, neighborhood TEXT, address TEXT,
    status TEXT, method TEXT, paid_at TEXT, created_at TEXT, contact_deleted_at TEXT, delivery_fee INTEGER, total INTEGER);
    INSERT INTO orders VALUES ('a','Ana','5583999123456','Manaíra','Rua A, 1','ready','delivery','x','x',NULL,0,2500),
      ('b','Bia','5583999123457','Bessa','Rua B, 2','out_for_delivery','delivery','x','x',NULL,0,2500),
      ('c','Caio','5583999123458','Brisamar','Rua C, 3','ready','delivery','x','x',NULL,500,3000),
      ('d','Dani','5583999123459','Manaíra','Rua D, 4','preparing','delivery','x','x',NULL,0,2500);
    ALTER TABLE orders ADD COLUMN updated_at TEXT DEFAULT 'x';`);
  const database = {
    prepare(sql) {
      return { sql, args: [], bind(...args) { this.args = args; return this; },
        run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...this.args).changes) } }; },
        all() { return { results: sqlite.prepare(sql).all(...this.args) }; },
        first() { return sqlite.prepare(sql).get(...this.args) ?? null; },
      };
    },
    batch(statements) {
      sqlite.exec("BEGIN");
      try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const store = { db: () => database, ensureSchema: async () => {},
    adminOnly: async request => request.headers.get("cookie") === "admin-session",
    sameOrigin: request => request.headers.get("origin") === "https://store.example",
    json: (body, status = 200) => Response.json(body, { status }),
  };
  const schema = load("../lib/delivery-route-assignments.ts", { "./store": store });
  const modules = { "@/lib/store": store, "@/lib/delivery-auth": { deliveryOnly: async request => request.headers.get("cookie") === "test-session" }, "@/lib/delivery-route-assignments": schema };
  const handler = load("../app/api/delivery/routes/route.ts", modules);
  const get = load("../app/api/delivery/orders/route.ts", modules).GET;
  const post = (body, cookie = "test-session", origin = "https://store.example") => handler.POST(new Request("https://store.example/api/delivery/routes", { method: "POST", headers: { "Content-Type": "application/json", cookie, origin }, body: JSON.stringify(body) }));
  const intervals = new Map(), timeouts = new Map();
  const eventsHandler = load("../app/api/delivery/events/route.ts", modules, {
    setInterval: fn => { const id = {}; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    setTimeout: fn => { const id = {}; timeouts.set(id, fn); return id; }, clearTimeout: id => timeouts.delete(id),
  });
  const events = (cookie = "test-session", signal) => eventsHandler.GET(new Request("https://store.example/api/delivery/events", { headers: { cookie }, signal }));
  return { sqlite, post, events, intervals, timeouts, tick: () => { for (const fn of [...intervals.values()]) fn(); },
    list: (cookie = "test-session") => get(new Request("https://store.example/api/delivery/orders", { headers: { cookie } })) };
}
const claim = (driverName, orderIds) => ({ action: "claim", driverName, orderIds });

test("Salva o nome e a sequência da rota e compartilha a atribuição na lista de entregas", async t => {
  const api = setup(t);
  const response = await api.post(claim("  João   Silva  ", ["b", "a"]));
  assert.equal(response.status, 201);
  const { routeId } = await response.json();
  const { orders } = await (await api.list()).json();
  assert.equal(orders.find(order => order.id === "b").driverName, "João Silva");
  assert.equal(orders.find(order => order.id === "b").routePosition, 1);
  assert.equal(orders.find(order => order.id === "a").routePosition, 2);
  assert.equal(orders.find(order => order.id === "a").routeId, routeId);
  assert.equal(orders.find(order => order.id === "a").phone, "5583999123456");
  assert.equal(orders.find(order => order.id === "c").routeId, null);
});

test("Dois entregadores disputando uma entrega: só um salva e o outro não pega parte da rota", async t => {
  const api = setup(t);
  const responses = await Promise.all([api.post(claim("João", ["a", "b"])), api.post(claim("Pedro", ["b", "c"]))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(api.sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_routes").get().n, 1);
  assert.equal(api.sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_route_orders").get().n, 2);
});

test("Cada um dos três entregadores pode ter sua própria rota", async t => {
  const api = setup(t);
  for (const [name, id] of [["João", "a"], ["Pedro", "b"], ["Érica", "c"]]) assert.equal((await api.post(claim(name, [id]))).status, 201);
  assert.equal(api.sqlite.prepare("SELECT COUNT(DISTINCT driver_name) AS n FROM delivery_routes").get().n, 3);
});

test("Libera só as entregas pendentes e conserva o responsável pelas concluídas", async t => {
  const api = setup(t);
  const { routeId } = await (await api.post(claim("João", ["a", "b"]))).json();
  api.sqlite.prepare("UPDATE orders SET status='completed' WHERE id='a'").run();
  assert.equal((await api.post({ action: "release", routeId })).status, 200);
  assert.equal(api.sqlite.prepare("SELECT route_id FROM delivery_route_orders WHERE order_id='a'").get().route_id, routeId);
  assert.equal(api.sqlite.prepare("SELECT route_id FROM delivery_route_orders WHERE order_id='b'").get(), undefined);
  assert.equal((await api.post(claim("Pedro", ["b"])) ).status, 201);
});

test("Não atribui pedidos em preparo, sem pagamento, de retirada, sem endereço ou removidos", async t => {
  const api = setup(t);
  for (const sql of ["status='preparing'", "paid_at=NULL", "method='pickup'", "address=' '", "contact_deleted_at='x'"]) {
    api.sqlite.exec("UPDATE orders SET status='ready',paid_at='x',method='delivery',address='Rua B, 2',contact_deleted_at=NULL WHERE id='b'");
    api.sqlite.exec(`UPDATE orders SET ${sql} WHERE id='b'`);
    assert.equal((await api.post(claim("João", ["a", "b"]))).status, 409);
    assert.equal(api.sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_route_orders").get().n, 0);
  }
});

test("Recusa nome vazio, pedidos duplicados, limites inválidos e acesso sem sessão ou de outra origem", async t => {
  const api = setup(t);
  for (const payload of [claim(" ", ["a"]), claim("x".repeat(61), ["a"]), claim("João", []), claim("João", ["a", "a"]), claim("João", Array.from({length: 41}, (_, i) => String(i))), claim("João", [null])]) assert.equal((await api.post(payload)).status, 400);
  assert.equal((await api.post(claim("João", ["a"]), "")).status, 403);
  assert.equal((await api.post(claim("João", ["a"]), "test-session", "https://other.example")).status, 403);
  assert.equal(api.sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_routes").get().n, 0);
});

test("Administrador atribui a rota usando a própria sessão e troca só o responsável pelas pendentes", async t => {
  const api = setup(t);
  const response = await api.post(claim("João", ["a", "b"]), "admin-session");
  assert.equal(response.status, 201);
  const { routeId } = await response.json();
  api.sqlite.exec("UPDATE orders SET status='completed' WHERE id='a'");
  const payload = { action: "reassign", routeId, driverName: "Pedro" };
  assert.equal((await api.post(payload)).status, 403);
  assert.equal((await api.post(payload, "admin-session")).status, 200);
  const { orders } = await (await api.list("admin-session")).json();
  assert.equal(orders.find(order => order.id === "a").driverName, "João");
  assert.equal(orders.find(order => order.id === "b").driverName, "Pedro");
  assert.notEqual(orders.find(order => order.id === "b").routeId, routeId);
  assert.equal((await api.post(payload, "admin-session")).status, 409);
});

test("Dois aparelhos recebem aviso de atribuição e de conclusão; sair fecha a conexão", async t => {
  const api = setup(t);
  const controller = new AbortController();
  const first = await api.events("test-session", controller.signal);
  const second = await api.events("admin-session");
  assert.match(first.headers.get("content-type"), /text\/event-stream/);
  const reader1 = first.body.getReader(), reader2 = second.body.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader1.read()).value), /event: sync/);
  await reader2.read();
  await api.post(claim("João", ["a"]), "admin-session");
  api.tick();
  for (const reader of [reader1, reader2]) {
    const event = decoder.decode((await reader.read()).value);
    assert.match(event, /event: sync/);
    assert.ok(!event.includes("Ana") && !event.includes("5583"));
  }
  api.sqlite.exec("UPDATE orders SET status='completed' WHERE id='a'");
  api.tick();
  assert.match(decoder.decode((await reader1.read()).value), /event: sync/);
  assert.match(decoder.decode((await reader2.read()).value), /event: sync/);
  controller.abort();
  assert.equal((await reader1.read()).done, true);
  await reader2.cancel();
  assert.equal(api.intervals.size, 0);
  assert.equal(api.timeouts.size, 0);
  assert.equal((await api.events("")).status, 403);
});

test("Reconexão envia uma atualização inicial e o encerramento programado libera os timers", async t => {
  const api = setup(t);
  const response = await api.events();
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /retry: 1000/);
  for (const fn of [...api.timeouts.values()]) fn();
  assert.equal((await reader.read()).done, true);
  assert.equal(api.intervals.size, 0);
});
