import { adminOnly, config, db, ensureSchema, json, paidCount, paymentHandle } from "@/lib/store";
import { ensureDeliveryRouteSchema } from "@/lib/delivery-route-assignments";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({error:"Acesso restrito."},403);
  await ensureSchema();
  await ensureDeliveryRouteSchema();
  const [settings,paid,orders,whatsappNotifications,emailNotifications] = await Promise.all([
    config(), paidCount(),
    db().prepare(`SELECT o.*,r.driver_name AS delivery_driver_name,r.id AS delivery_route_id
      FROM orders o LEFT JOIN delivery_route_orders ro ON ro.order_id=o.id
      LEFT JOIN delivery_routes r ON r.id=ro.route_id ORDER BY o.created_at DESC LIMIT 500`).all(),
    db().prepare("SELECT order_id,event,state,attempts,last_error,accepted_at FROM order_notifications ORDER BY updated_at DESC LIMIT 500").all(),
    db().prepare("SELECT order_id,event,state,attempts,last_error,accepted_at FROM email_notifications ORDER BY updated_at DESC LIMIT 500").all(),
  ]);
  const notifications = [
    ...whatsappNotifications.results.map(notice => ({ ...notice, channel: "whatsapp" })),
    ...emailNotifications.results.map(notice => ({ ...notice, channel: "email" })),
  ];
  return json({orders:orders.results,notifications,settings,paid,demo:!paymentHandle()});
}
