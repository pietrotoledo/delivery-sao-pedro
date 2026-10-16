import { db, type Order } from "./store";
import { ensureNotificationSchema, notificationBatch } from "./notification-queue";
import { evolutionEnabled, orderNoticeMessage } from "./evolution-notifications";
import { dueEventReminder, eventSchedule } from "./event-schedule";

/** Registers each reminder once; the existing notification queue handles sending/retries. */
export async function queueEventReminders(now = new Date()) {
  const reminder = dueEventReminder(now);
  if (!reminder || !evolutionEnabled()) return;
  await ensureNotificationSchema();
  const database = db();
  const cutoff = new Date(reminder.start).toISOString();
  const orders = await database.prepare(`SELECT * FROM orders
    WHERE paid_at IS NOT NULL AND paid_at<=? AND contact_deleted_at IS NULL
      AND whatsapp_opt_in=1 AND status NOT IN ('completed','refunded')
      AND (payment_mode IS NULL OR payment_mode<>'demo')
      AND (payment_note IS NULL OR payment_note NOT LIKE 'TESTE SEM PAGAMENTO REAL%')
      AND NOT EXISTS (SELECT 1 FROM order_notifications n WHERE n.order_id=orders.id AND n.event=?)
    ORDER BY created_at LIMIT ?`)
    .bind(cutoff, reminder.event, notificationBatch.reminders).all<Order>();
  if (!orders.results.length) return;
  const timestamp = now.toISOString();
  await database.batch(orders.results.map(order => database.prepare(
    "INSERT OR IGNORE INTO order_notifications (id,order_id,event,message,updated_at) VALUES (?,?,?,?,?)"
  ).bind(`${order.id}:${reminder.event}`, order.id, reminder.event,
    orderNoticeMessage(order, reminder.event, eventSchedule.origin), timestamp)));
}
