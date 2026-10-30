import { deliveryOnly } from "@/lib/delivery-auth";
import { adminOnly, db, ensureSchema, json, type Order } from "@/lib/store";
import { ensureDeliveryRouteSchema } from "@/lib/delivery-route-assignments";

export async function GET(request: Request) {
  if (!await deliveryOnly(request) && !await adminOnly(request)) return json({ error: "Acesso restrito à equipe." }, 403);
  await ensureSchema();
  await ensureDeliveryRouteSchema();
  const result = await db().prepare(`SELECT o.id,o.name,o.phone,o.neighborhood,o.address,o.status,o.delivery_fee,o.total,
      r.id AS route_id,r.driver_name,ro.position AS route_position
    FROM orders o LEFT JOIN delivery_route_orders ro ON ro.order_id=o.id
    LEFT JOIN delivery_routes r ON r.id=ro.route_id
    WHERE o.method = 'delivery' AND o.paid_at IS NOT NULL AND o.status IN ('paid','preparing','ready','out_for_delivery','completed')
    AND o.contact_deleted_at IS NULL ORDER BY CASE o.status WHEN 'out_for_delivery' THEN 0 WHEN 'ready' THEN 1 WHEN 'preparing' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END, o.paid_at, o.created_at LIMIT 200`).all<Order & { route_id: string | null; driver_name: string | null; route_position: number | null }>();
  return json({ orders: result.results.map(order => ({
    id: order.id, name: order.name, neighborhood: order.neighborhood,
    address: order.address, status: order.status,
    phone: order.phone, routeId: order.route_id, driverName: order.driver_name, routePosition: order.route_position,
    feeToArrange: order.delivery_fee === null && order.total !== null,
  })) });
}
