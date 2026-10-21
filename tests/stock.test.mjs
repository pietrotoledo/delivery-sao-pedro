import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const load = (path, modules) => {
  const context = { exports: {}, require: name => modules[name], Date, Map, Array, Math, JSON, console };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
};

// Adaptador mínimo da API do D1 sobre SQLite, com lote transacional como no Cloudflare.
function d1(sqlite) {
  const prepare = sql => {
    const statement = {
      args: [],
      bind(...args) { statement.args = args; return statement; },
      run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...statement.args).changes) } }; },
      first() { return sqlite.prepare(sql).get(...statement.args) ?? null; },
      all() { return { results: sqlite.prepare(sql).all(...statement.args) }; },
    };
    return statement;
  };
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = statements.map(statement => statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE products(id TEXT PRIMARY KEY, stock INTEGER, updated_at TEXT);
    INSERT INTO products VALUES ('classic',4,'x'),('combo',4,'x'),('coke',9,'x'),('fries-small',NULL,'x');
    CREATE TABLE orders(id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, items_json TEXT, burger_count INTEGER, status TEXT, paid_at TEXT);
    CREATE TABLE settings(id INTEGER PRIMARY KEY, capacity INTEGER, paused INTEGER);
    INSERT INTO settings VALUES (1,10,0);`);
  const database = d1(sqlite);
  const menuOptions = load('../lib/menu-options.ts', {});
  const rules = load('../lib/stock-rules.ts', { './menu-options': menuOptions });
  const store = {
    db: () => database, ensureSchema: async () => {},
    orderItems: order => JSON.parse(order.items_json),
  };
  const stock = load('../lib/stock.ts', { './stock-rules': rules, './store': store });
  const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
  const addOrder = (id, status, minutes, paid = false) => sqlite.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?)')
    .run(id, ago(minutes), ago(minutes), JSON.stringify([{ id: 'classic', quantity: 1 }, { id: 'combo', quantity: 1, unitDrinks: ['Coca-Cola normal'] }, { id: 'fries-small', quantity: 1 }]), 2, status, paid ? ago(minutes) : null);
  const stockOf = id => sqlite.prepare('SELECT stock FROM products WHERE id=?').get(id).stock;
  const statusOf = id => sqlite.prepare('SELECT status FROM orders WHERE id=?').get(id).status;
  return { sqlite, database, stock, addOrder, stockOf, statusOf };
}

test('Pix não pago em 30 minutos expira e devolve o estoque uma única vez', async () => {
  const { stock, addOrder, stockOf, statusOf } = setup();
  addOrder('vencido', 'awaiting_payment', 31);
  addOrder('recente', 'awaiting_payment', 10);
  addOrder('pago', 'paid', 60, true);
  assert.equal(await stock.releaseExpiredOrders(), 1);
  assert.equal(statusOf('vencido'), 'expired');
  assert.equal(statusOf('recente'), 'awaiting_payment');
  assert.equal(statusOf('pago'), 'paid');
  assert.equal(stockOf('classic'), 5);
  assert.equal(stockOf('combo'), 5);
  assert.equal(stockOf('coke'), 10, 'a bebida do combo também volta');
  assert.equal(stockOf('fries-small'), null, 'produto sem limite continua sem limite');
  assert.equal(await stock.releaseExpiredOrders(), 0);
  assert.equal(stockOf('classic'), 5, 'não devolve duas vezes');
});

test('Pagamento que chega depois de expirar reserva o estoque de novo', async () => {
  const { database, stock, addOrder, stockOf, statusOf } = setup();
  addOrder('atrasado', 'awaiting_payment', 45);
  await stock.releaseExpiredOrders();
  assert.equal(stockOf('classic'), 5);
  const order = { id: 'atrasado', items_json: JSON.stringify([{ id: 'classic', quantity: 1 }, { id: 'combo', quantity: 1, unitDrinks: ['Coca-Cola normal'] }]) };
  const pay = () => database.batch([
    ...stock.takeStockStatements(order, "paid_at IS NULL AND status='expired'", []),
    database.prepare("UPDATE orders SET status='paid',paid_at='agora' WHERE id=? AND paid_at IS NULL AND status IN ('ready_for_payment','awaiting_payment','expired')").bind('atrasado'),
  ]);
  await pay();
  assert.equal(statusOf('atrasado'), 'paid');
  assert.equal(stockOf('classic'), 4);
  assert.equal(stockOf('coke'), 9);
  await pay();
  assert.equal(stockOf('classic'), 4, 'aviso de pagamento repetido não desconta de novo');
});

test('Devolução repõe o estoque só antes da entrega', async () => {
  const { database, stock, addOrder, stockOf } = setup();
  addOrder('preparo', 'preparing', 5, true);
  addOrder('entregue', 'completed', 5, true);
  for (const id of ['preparo', 'entregue']) {
    const order = { id, items_json: JSON.stringify([{ id: 'classic', quantity: 2 }]) };
    await database.batch([
      ...stock.restoreStockStatements(order, "status IN ('paid','preparing','ready')", []),
      database.prepare("UPDATE orders SET status='refunded' WHERE id=? AND status<>'refunded'").bind(id),
    ]);
  }
  assert.equal(stockOf('classic'), 6, 'só o pedido em preparo devolveu 2');
});

test('Limite de hambúrgueres ignora pedidos expirados e devolvidos', async () => {
  const { sqlite, stock, addOrder } = setup();
  addOrder('a', 'paid', 5, true);
  addOrder('b', 'awaiting_payment', 5);
  addOrder('c', 'expired', 50);
  addOrder('d', 'refunded', 50, true);
  assert.deepEqual({ ...await stock.burgerAvailability() }, { reserved: 4, capacity: 10, left: 6 });
  sqlite.exec('UPDATE settings SET capacity=3');
  assert.equal((await stock.burgerAvailability()).left, 0);
});
