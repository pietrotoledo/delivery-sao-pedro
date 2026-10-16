import { env, waitUntil } from "cloudflare:workers";
import { db, ensureSchema, getOrder, type Order } from "./store";
import { eventReminderActive, eventReminderText, isEventReminder, orderEventSchedule, type EventReminder } from "./event-schedule";
import { ensureNotificationSchema, notificationBatch, pixNoticeExpired } from "./notification-queue";

export type OrderNotice = "pix_available" | "paid" | "preparing" | "ready" | "out_for_delivery" | "completed" | EventReminder;

type NoticeRow = {
  id: string; order_id: string; event: OrderNotice; message: string;
  state: string; attempts: number; next_attempt_at: string | null;
};

function settings() {
  const base = env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const key = env.EVOLUTION_API_KEY?.trim();
  const instance = env.EVOLUTION_INSTANCE?.trim();
  if (!base || !key || !instance) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return {base, key, instance};
  } catch { return null; }
}

export function evolutionEnabled() { return Boolean(settings()); }

export function orderNoticeMessage(order: Order, event: OrderNotice, origin: string) {
  const number = order.id.slice(0, 8).toUpperCase();
  const track = `${origin}/pedido/${order.id}`;
  const prefix = `BLUECKYARDIGANS \u00b7 Pedido #${number}\n`;
  switch (event) {
    case "pix_available":
      return order.checkout_url && !order.paid_at
        ? `${prefix}Seu Pix est\u00e1 pronto. Confira o valor e pague aqui: ${order.checkout_url}\nAcompanhe o pedido: ${track}` : null;
    case "paid": return `${prefix}Pagamento confirmado! Seu pedido está garantido para a Noite do Hambúrguer.\n\n${orderEventSchedule(order.method)}\n\nAcompanhe seu pedido: ${track}`;
    case "preparing": return `${prefix}Seu pedido est\u00e1 em preparo. Acompanhe: ${track}`;
    case "ready": return order.method === "pickup"
      ? `${prefix}Seu pedido est\u00e1 pronto para retirada. Leve os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`
      : `${prefix}Seu pedido est\u00e1 pronto e ser\u00e1 encaminhado para entrega. Acompanhe: ${track}`;
    case "out_for_delivery": return `${prefix}Seu pedido saiu para entrega. Informe ao entregador os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`;
    case "completed": return `${prefix}Seu pedido foi finalizado. Obrigado pela compra! ${track}`;
    case "event_morning":
    case "event_evening": return `${prefix}${eventReminderText(order.method, event)}\nAcompanhe seu pedido: ${track}`;
  }
}

function phoneNumber(order: Order) {
  const digits = order.phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return /^\d{10,11}$/.test(local) ? `55${local}` : null;
}

export function scheduleOrderNotice(orderId: string, event: OrderNotice, origin: string) {
  if (!evolutionEnabled()) return;
  waitUntil(enqueueOrderNotice(orderId, event, origin).catch(error => {
    console.error("Falha ao registrar aviso Evolution", error);
  }));
}

async function enqueueOrderNotice(orderId: string, event: OrderNotice, origin: string) {
  const order = await getOrder(orderId);
  if (!order?.whatsapp_opt_in || order.contact_deleted_at || !phoneNumber(order)) return;
  const text = orderNoticeMessage(order, event, new URL(origin).origin);
  if (!text) return;
  await ensureSchema();
  const now = new Date().toISOString();
  const id = `${orderId}:${event}`;
  const result = await db().prepare("INSERT OR IGNORE INTO order_notifications (id,order_id,event,message,updated_at) VALUES (?,?,?,?,?)")
    .bind(id, orderId, event, text, now).run();
  if (!result.meta.changes) return;
  await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE order_id=? AND id<>? AND event NOT IN ('event_morning','event_evening') AND state IN ('pending','failed')")
    .bind(now, orderId, id).run();
  await sendNotice(id);
}

async function sendNotice(id: string) {
  const config = settings();
  if (!config) return;
  const now = new Date().toISOString();
  const claim = await db().prepare("UPDATE order_notifications SET state='sending',attempts=attempts+1,updated_at=? WHERE id=? AND (state='pending' OR (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)))")
    .bind(now, id, now).run();
  if (!claim.meta.changes) return;
  const notice = await db().prepare("SELECT * FROM order_notifications WHERE id=?").bind(id).first<NoticeRow>();
  if (!notice) return;
  const order = await getOrder(notice.order_id, true);
  const number = order && phoneNumber(order);
  const expiredReminder = isEventReminder(notice.event) && (!eventReminderActive(notice.event) || !order?.paid_at || order.status === "completed");
  if (!order?.whatsapp_opt_in || order.contact_deleted_at || !number || order.status === "refunded" || expiredReminder || pixNoticeExpired(order, notice.event)) {
    await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return;
  }
  let submitted = false;
  let rejected = false;
  let providerId: string | undefined;
  try {
    // A read-only preflight can fail/retry safely: no message has been submitted yet.
    const connection = await fetch(`${config.base}/instance/connectionState/${encodeURIComponent(config.instance)}`, {
      headers: { apikey: config.key }, signal: AbortSignal.timeout(5_000),
    });
    if (!connection.ok) throw new Error(`Conexão Evolution respondeu HTTP ${connection.status}`);
    const state = await connection.json() as { instance?: { state?: string } };
    if (state.instance?.state !== "open") throw new Error("WhatsApp desconectado; nova tentativa programada");
    submitted = true;
    const response = await fetch(`${config.base}/message/sendText/${encodeURIComponent(config.instance)}`, {
      method: "POST", headers: {"Content-Type": "application/json", apikey: config.key},
      body: JSON.stringify({number, text: notice.message}), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      rejected = [401, 403, 404, 429].includes(response.status);
      throw new Error(`Evolution respondeu HTTP ${response.status}`);
    }
    const result = await response.json() as { key?: { id?: string } };
    providerId = result.key?.id;
    if (!providerId) throw new Error("Evolution não confirmou o identificador da mensagem");
    await db().prepare("UPDATE order_notifications SET state='accepted',accepted_at=?,last_error=NULL,updated_at=? WHERE id=?")
      .bind(new Date().toISOString(), new Date().toISOString(), id).run();
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(6, notice.attempts));
    const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    const uncertain = submitted && !rejected;
    const detail = error instanceof Error ? error.message : "Falha no envio";
    const prefix = uncertain ? "Confira o WhatsApp antes de reenviar. " : rejected ? "Rejeitado HTTP: " : "Antes do envio: ";
    const reason = `${prefix}${providerId ? `Mensagem ${providerId}. ` : ""}${detail}`.slice(0, 300);
    await db().prepare("UPDATE order_notifications SET state=?,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?")
      .bind(uncertain ? "uncertain" : "failed", uncertain ? null : retryAt, reason, new Date().toISOString(), id).run();
  }
}

export function scheduleNotificationRetries() {
  if (!evolutionEnabled()) return;
  waitUntil(retryEvolutionNotifications().catch(error => console.error("Falha ao repetir avisos Evolution", error)));
}

export async function retryEvolutionNotifications() {
  if (!evolutionEnabled()) return;
  await ensureNotificationSchema();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 60_000).toISOString();
  await db().prepare("UPDATE order_notifications SET state='uncertain',next_attempt_at=NULL,last_error=SUBSTR('Envio incerto; confira o WhatsApp antes de reenviar. ' || COALESCE(last_error,''),1,300),updated_at=? WHERE (state='sending' AND updated_at<=?) OR (state='failed' AND (last_error IS NULL OR (last_error NOT LIKE 'Antes do envio:%' AND last_error NOT LIKE 'Rejeitado HTTP:%')))")
    .bind(now, stale).run();
  await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE event='pix_available' AND state IN ('pending','failed') AND EXISTS (SELECT 1 FROM orders WHERE orders.id=order_notifications.order_id AND (paid_at IS NOT NULL OR status NOT IN ('ready_for_payment','awaiting_payment')))")
    .bind(now).run();
  const rows = await db().prepare("SELECT id FROM order_notifications WHERE state='pending' OR (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) ORDER BY updated_at LIMIT ?")
    .bind(now, notificationBatch.whatsapp).all<{id: string}>();
  for (const row of rows.results) await sendNotice(row.id);
}
