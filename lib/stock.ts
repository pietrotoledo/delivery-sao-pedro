import { capacitySql, pendingPaymentMinutes, pendingStatuses, reservedBurgersSql, stockRequirements } from "./stock-rules";
import { db, ensureSchema, orderItems, type Order } from "./store";

const pending = pendingStatuses.map(status => `'${status}'`).join(",");

export async function burgerAvailability() {
  await ensureSchema();
  const row = await db().prepare(`SELECT ${reservedBurgersSql} AS reserved, ${capacitySql} AS capacity`).first<{ reserved: number; capacity: number }>();
  const reserved = row?.reserved ?? 0;
  const capacity = row?.capacity ?? 100;
  return { reserved, capacity, left: Math.max(0, capacity - reserved) };
}

// Devolve o estoque de um pedido. A condição roda junto com a mudança de status no mesmo lote,
// então o estoque só volta uma vez, mesmo com duas requisições ao mesmo tempo.
export function restoreStockStatements(order: Order, condition: string, conditionArgs: unknown[]) {
  const database = db();
  const now = new Date().toISOString();
  return stockRequirements(orderItems(order)).map(item => database.prepare(`UPDATE products SET stock=stock+?,updated_at=? WHERE id=? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id=? AND ${condition})`)
    .bind(item.quantity, now, item.id, order.id, ...conditionArgs));
}

export function takeStockStatements(order: Order, condition: string, conditionArgs: unknown[]) {
  const database = db();
  const now = new Date().toISOString();
  return stockRequirements(orderItems(order)).map(item => database.prepare(`UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id=? AND ${condition})`)
    .bind(item.quantity, now, item.id, order.id, ...conditionArgs));
}

// Libera o estoque de pedidos cujo Pix não foi pago dentro do prazo.
export async function releaseExpiredOrders(now = new Date()) {
  await ensureSchema();
  const cutoff = new Date(now.getTime() - pendingPaymentMinutes * 60_000).toISOString();
  const rows = await db().prepare(`SELECT * FROM orders WHERE paid_at IS NULL AND status IN (${pending}) AND created_at <= ? ORDER BY created_at LIMIT 50`).bind(cutoff).all<Order>();
  const condition = `paid_at IS NULL AND status IN (${pending})`;
  let released = 0;
  for (const order of rows.results) {
    const timestamp = new Date().toISOString();
    const results = await db().batch([
      ...restoreStockStatements(order, condition, []),
      db().prepare(`UPDATE orders SET status='expired',updated_at=? WHERE id=? AND ${condition}`).bind(timestamp, order.id),
    ]);
    if (results.at(-1)?.meta.changes) released++;
  }
  return released;
}
