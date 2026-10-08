import { env, waitUntil } from "cloudflare:workers";
import { db, ensureSchema, getOrder, type Order } from "./store";

export type OrderNotice = "pix_available" | "paid" | "preparing" | "ready" | "out_for_delivery" | "completed";

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

function message(order: Order, event: OrderNotice, origin: string) {
  const number = order.id.slice(0, 8).toUpperCase();
  const track = `${origin}/pedido/${order.id}`;
  const prefix = `BLUECKYARDIGANS \u00b7 Pedido #${number}\n`;
  switch (event) {
    case "pix_available":
      return order.checkout_url && !order.paid_at
        ? `${prefix}Seu Pix est\u00e1 pronto. Confira o valor e pague aqui: ${order.checkout_url}\nAcompanhe o pedido: ${track}` : null;
    case "paid": return `${prefix}Pagamento confirmado! Acompanhe seu pedido: ${track}`;
    case "preparing": return `${prefix}Seu pedido est\u00e1 em preparo. Acompanhe: ${track}`;
    case "ready": return order.method === "pickup"
      ? `${prefix}Seu pedido est\u00e1 pronto para retirada. Leve os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`
      : `${prefix}Seu pedido est\u00e1 pronto e ser\u00e1 encaminhado para entrega. Acompanhe: ${track}`;
    case "out_for_delivery": return `${prefix}Seu pedido saiu para entrega. Informe ao entregador os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`;
    case "completed": return `${prefix}Seu pedido foi finalizado. Obrigado pela compra! ${track}`;
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
  const text = message(order, event, new URL(origin).origin);
  if (!text) return;
  await ensureSchema();
  const now = new Date().toISOString();
  const id = `${orderId}:${event}`;
  const result = await db().prepare("INSERT OR IGNORE INTO order_notifications (id,order_id,event,message,updated_at) VALUES (?,?,?,?,?)")
    .bind(id, orderId, event, text, now).run();
  if (!result.meta.changes) return;
  await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE order_id=? AND id<>? AND state IN ('pending','failed')")
    .bind(now, orderId, id).run();
  await sendNotice(id);
}

async function sendNotice(id: string) {
  const config = settings();
  if (!config) return;
  const now = new Date().toISOString();
  const claim = await db().prepare("UPDATE order_notifications SET state='sending',attempts=attempts+1,updated_at=? WHERE id=? AND (state='pending' OR (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (state='sending' AND updated_at<=?))")
    .bind(now, id, now, new Date(Date.now() - 60_000).toISOString()).run();
  if (!claim.meta.changes) return;
  const notice = await db().prepare("SELECT * FROM order_notifications WHERE id=?").bind(id).first<NoticeRow>();
  if (!notice) return;
  const order = await getOrder(notice.order_id);
  const number = order && phoneNumber(order);
  if (!order?.whatsapp_opt_in || order.contact_deleted_at || !number || order.status === "refunded") {
    await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return;
  }
  try {
    const response = await fetch(`${config.base}/message/sendText/${encodeURIComponent(config.instance)}`, {
      method: "POST", headers: {"Content-Type": "application/json", apikey: config.key},
      body: JSON.stringify({number, text: notice.message}), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Evolution respondeu HTTP ${response.status}`);
    await db().prepare("UPDATE order_notifications SET state='accepted',accepted_at=?,last_error=NULL,updated_at=? WHERE id=?")
      .bind(new Date().toISOString(), new Date().toISOString(), id).run();
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(6, notice.attempts));
    const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    const reason = error instanceof Error ? error.message.slice(0, 200) : "Falha no envio";
    await db().prepare("UPDATE order_notifications SET state='failed',next_attempt_at=?,last_error=?,updated_at=? WHERE id=?")
      .bind(retryAt, reason, new Date().toISOString(), id).run();
  }
}

export function scheduleNotificationRetries() {
  if (!evolutionEnabled()) return;
  waitUntil(retryNotifications().catch(error => console.error("Falha ao repetir avisos Evolution", error)));
}

async function retryNotifications() {
  await ensureSchema();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 60_000).toISOString();
  const rows = await db().prepare("SELECT id FROM order_notifications WHERE (state='failed' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (state='sending' AND updated_at<=?) ORDER BY updated_at LIMIT 10")
    .bind(now, stale).all<{id: string}>();
  await Promise.all(rows.results.map(row => sendNotice(row.id)));
}
