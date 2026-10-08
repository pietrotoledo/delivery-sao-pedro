import { adminOnly, config, db, ensureSchema, json, paidCount, paymentHandle } from "@/lib/store";
import { scheduleNotificationRetries } from "@/lib/evolution-notifications";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({error:"Acesso restrito."},403);
  await ensureSchema();
  scheduleNotificationRetries();
  const [settings,paid,orders,notifications] = await Promise.all([
    config(), paidCount(),
    db().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all(),
    db().prepare("SELECT order_id,event,state,attempts,last_error,accepted_at FROM order_notifications ORDER BY updated_at DESC LIMIT 500").all(),
  ]);
  return json({orders:orders.results,notifications:notifications.results,settings,paid,demo:!paymentHandle()});
}
