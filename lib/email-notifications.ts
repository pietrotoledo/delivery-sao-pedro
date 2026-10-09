import { env, waitUntil } from "cloudflare:workers";
import { db, ensureSchema, getOrder } from "./store";
import { orderNoticeMessage, type OrderNotice } from "./evolution-notifications";

type EmailNoticeRow = {
  id: string; order_id: string; event: OrderNotice; subject: string; message: string;
  attempts: number;
};

const subjects: Record<OrderNotice, string> = {
  pix_available: "Seu Pix está pronto",
  paid: "Pagamento confirmado",
  preparing: "Seu pedido está em preparo",
  ready: "Seu pedido está pronto",
  out_for_delivery: "Seu pedido saiu para entrega",
  completed: "Pedido concluído",
};

function settings() {
  const key = env.RESEND_API_KEY?.trim();
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  if (!key || !fromEmail || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromEmail)) return null;
  return { key, from: `BLUECKYARDIGANS <${fromEmail}>` };
}

export function emailEnabled() { return Boolean(settings()); }

export function scheduleOrderEmail(orderId: string, event: OrderNotice, origin: string) {
  if (!emailEnabled()) return;
  waitUntil(enqueueOrderEmail(orderId, event, origin).catch(error => {
    console.error("Falha ao registrar aviso por e-mail", error);
  }));
}

async function enqueueOrderEmail(orderId: string, event: OrderNotice, origin: string) {
  const order = await getOrder(orderId);
  if (!order?.email || order.contact_deleted_at) return;
  const message = orderNoticeMessage(order, event, new URL(origin).origin);
  if (!message) return;
  await ensureSchema();
  const now = new Date().toISOString();
  const id = `${orderId}:${event}`;
  const subject = `${subjects[event]} · Pedido #${orderId.slice(0, 8).toUpperCase()}`;
  const result = await db().prepare("INSERT OR IGNORE INTO email_notifications (id,order_id,event,subject,message,updated_at) VALUES (?,?,?,?,?,?)")
    .bind(id, orderId, event, subject, message, now).run();
  if (!result.meta.changes) return;
  await db().prepare("UPDATE email_notifications SET state='superseded',updated_at=? WHERE order_id=? AND id<>? AND state IN ('pending','failed')")
    .bind(now, orderId, id).run();
  await sendEmailNotice(id);
}

async function sendEmailNotice(id: string) {
  const config = settings();
  if (!config) return;
  const now = new Date().toISOString();
  const claim = await db().prepare("UPDATE email_notifications SET state='sending',attempts=attempts+1,updated_at=? WHERE id=? AND (state='pending' OR (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (state='sending' AND updated_at<=?))")
    .bind(now, id, now, new Date(Date.now() - 60_000).toISOString()).run();
  if (!claim.meta.changes) return;
  const notice = await db().prepare("SELECT id,order_id,event,subject,message,attempts FROM email_notifications WHERE id=?")
    .bind(id).first<EmailNoticeRow>();
  if (!notice) return;
  const order = await getOrder(notice.order_id);
  if (!order?.email || order.contact_deleted_at || order.status === "refunded") {
    await db().prepare("UPDATE email_notifications SET state='superseded',updated_at=? WHERE id=?")
      .bind(new Date().toISOString(), id).run();
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `order-email:${notice.id}`,
      },
      body: JSON.stringify({ from: config.from, to: [order.email], subject: notice.subject, text: notice.message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend respondeu HTTP ${response.status}`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Resend não confirmou o identificador do e-mail");
    const acceptedAt = new Date().toISOString();
    await db().prepare("UPDATE email_notifications SET state='accepted',accepted_at=?,last_error=NULL,updated_at=? WHERE id=?")
      .bind(acceptedAt, acceptedAt, id).run();
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(6, notice.attempts));
    const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    const reason = error instanceof Error ? error.message.slice(0, 200) : "Falha no envio";
    await db().prepare("UPDATE email_notifications SET state='failed',next_attempt_at=?,last_error=?,updated_at=? WHERE id=?")
      .bind(retryAt, reason, new Date().toISOString(), id).run();
  }
}

export function scheduleEmailRetries() {
  if (!emailEnabled()) return;
  waitUntil(retryEmailNotifications().catch(error => console.error("Falha ao repetir avisos por e-mail", error)));
}

export async function retryEmailNotifications() {
  if (!emailEnabled()) return;
  await ensureSchema();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 60_000).toISOString();
  const rows = await db().prepare("SELECT id FROM email_notifications WHERE state='pending' OR (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (state='sending' AND updated_at<=?) ORDER BY updated_at LIMIT 10")
    .bind(now, stale).all<{ id: string }>();
  await Promise.all(rows.results.map(row => sendEmailNotice(row.id)));
}
