import { db } from "./store";

// One cron invocation shares this budget across both channels and event registration.
export const notificationBatch = { whatsapp: 3, email: 2, reminders: 8 } as const;

let ready: Promise<void> | undefined;
export async function ensureNotificationSchema() {
  ready ??= (async () => {
    await db().prepare(`CREATE TABLE IF NOT EXISTS order_notifications (
      id text PRIMARY KEY NOT NULL, order_id text NOT NULL, event text NOT NULL,
      message text NOT NULL, state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
      next_attempt_at text, last_error text, accepted_at text, updated_at text NOT NULL,
      UNIQUE(order_id,event)
    )`).run();
    await db().prepare(`CREATE TABLE IF NOT EXISTS email_notifications (
      id text PRIMARY KEY NOT NULL, order_id text NOT NULL, event text NOT NULL,
      subject text NOT NULL, message text NOT NULL, state text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0, next_attempt_at text, last_error text,
      accepted_at text, updated_at text NOT NULL, UNIQUE(order_id,event)
    )`).run();
  })().catch(error => { ready = undefined; throw error; });
  await ready;
}

export function pixNoticeExpired(order: { paid_at: string | null; status: string }, event: string) {
  return event === "pix_available" && (Boolean(order.paid_at) || !["ready_for_payment", "awaiting_payment"].includes(order.status));
}
