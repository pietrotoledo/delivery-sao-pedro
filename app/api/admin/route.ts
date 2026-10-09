import { adminOnly, config, db, ensureSchema, json, paidCount, paymentHandle } from "@/lib/store";
import { scheduleOrderNotificationRetries } from "@/lib/order-notifications";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({error:"Acesso restrito."},403);
  await ensureSchema();
  scheduleOrderNotificationRetries();
  const [settings,paid,orders,whatsappNotifications,emailNotifications] = await Promise.all([
    config(), paidCount(),
    db().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all(),
    db().prepare("SELECT order_id,event,state,attempts,last_error,accepted_at FROM order_notifications ORDER BY updated_at DESC LIMIT 500").all(),
    db().prepare("SELECT order_id,event,state,attempts,last_error,accepted_at FROM email_notifications ORDER BY updated_at DESC LIMIT 500").all(),
  ]);
  const notifications = [
    ...whatsappNotifications.results.map(notice => ({ ...notice, channel: "whatsapp" })),
    ...emailNotifications.results.map(notice => ({ ...notice, channel: "email" })),
  ];
  return json({orders:orders.results,notifications,settings,paid,demo:!paymentHandle()});
}
