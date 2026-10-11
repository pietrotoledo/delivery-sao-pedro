import { deliveryOnly } from "@/lib/delivery-auth";
import { db, ensureSchema, json, orderItems, type Order } from "@/lib/store";

export async function GET(request: Request) {
  if (!await deliveryOnly(request)) return json({ error: "Acesso restrito aos entregadores." }, 403);
  await ensureSchema();
  const result = await db().prepare(`SELECT id,created_at,name,phone,neighborhood,address,notes,items_json,status,paid_at
    FROM orders WHERE method = 'delivery' AND paid_at IS NOT NULL AND status IN ('paid','preparing','ready','out_for_delivery','completed')
    AND contact_deleted_at IS NULL ORDER BY CASE status WHEN 'out_for_delivery' THEN 0 WHEN 'ready' THEN 1 WHEN 'preparing' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END, paid_at, created_at LIMIT 200`).all<Order>();
  return json({ orders: result.results.map(order => ({
    id: order.id, createdAt: order.created_at, name: order.name, phone: order.phone,
    neighborhood: order.neighborhood, address: order.address, notes: order.notes,
    items: orderItems(order).map(item => ({ name: item.name, quantity: item.quantity })),
    status: order.status,
  })) });
}
