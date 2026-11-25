import { env, waitUntil } from "cloudflare:workers";
import { db, ensureSchema, getOrder, type Order } from "./store";
import { eventReminderActive, eventReminderText, isEventReminder, orderEventSchedule, type EventReminder } from "./event-schedule";
import { defaultStoreWhatsapp } from "./store-contact";
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

// Pedido de entrega em bairro com taxa a combinar: o frete é calculado pelo Uber Moto e enviado pelo WhatsApp.
export const deliveryFeeToArrange = (order: Pick<Order, "method" | "delivery_fee" | "total">) =>
  order.method === "delivery" && order.delivery_fee === null && order.total !== null;

export const uberMotoNotice = "Vamos calcular o seu frete pelo Uber Moto e te enviar o valor por aqui no WhatsApp. Se precisar falar com a gente, é só responder esta mensagem.";

// Número de WhatsApp da loja exibido ao cliente: (61) 99647-9192. STORE_WHATSAPP substitui, se definido.
export function storeWhatsapp(): string {
  const configured = env.STORE_WHATSAPP?.replace(/\D/g, "");
  if (!configured) return defaultStoreWhatsapp;
  return configured.length <= 11 ? `55${configured}` : configured;
}

export function orderNoticeMessage(order: Order, event: OrderNotice, origin: string) {
  if (order.method === "pickup" && (order.status === "completed" || event === "completed")) return null;
  const number = order.id.slice(0, 8).toUpperCase();
  const track = `${origin}/pedido/${order.id}`;
  const prefix = `BLUECKYARDIGANS \u00b7 Pedido #${number}\n`;
  switch (event) {
    case "pix_available":
      return order.checkout_url && !order.paid_at
        ? `${prefix}Seu Pix est\u00e1 pronto. Confira o valor e pague aqui: ${order.checkout_url}\nAcompanhe o pedido: ${track}` : null;
    case "paid": return `${prefix}Pagamento confirmado! Seu pedido está garantido para a Noite do Hambúrguer.\n\n${orderEventSchedule(order.method, order.event_day)}${deliveryFeeToArrange(order) ? `\n\n${uberMotoNotice}` : ""}\n\nAcompanhe seu pedido: ${track}`;
    case "preparing": return `${prefix}Seu pedido est\u00e1 em preparo. Acompanhe: ${track}`;
    case "ready": return order.method === "pickup"
      ? `${prefix}Seu pedido est\u00e1 pronto para retirada. Leve os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`
      : `${prefix}Seu pedido est\u00e1 pronto e ser\u00e1 encaminhado para entrega. Acompanhe: ${track}`;
    case "out_for_delivery": return `${prefix}Seu pedido saiu para entrega. Informe ao entregador os quatro \u00faltimos d\u00edgitos do telefone usado na compra. Acompanhe: ${track}`;
    case "completed": return `${prefix}Seu pedido foi finalizado. Obrigado pela compra! ${track}`;
    case "event_morning":
    case "event_evening": return `${prefix}${eventReminderText(order.method, event, order.event_day)}\nAcompanhe seu pedido: ${track}`;
  }
}

// O número da loja já levou bloqueio de 24h. O WhatsApp manda só o essencial; o e-mail continua com todos os eventos.
// Fica fora: Pix logo após o pedido, pagamento confirmado no presencial, "em preparo", "pronto" na entrega,
// conclusão e os lembretes do dia do evento (o "pagamento confirmado" já traz data e horário).
export const whatsappPixReminderMinutes = 15;
// Intervalo mínimo entre duas mensagens quaisquer da loja (1 min), mais até 1 min aleatório no envio agendado.
export const whatsappGap = { minSeconds: 60, jitterSeconds: 60 } as const;

export function skippedOnWhatsapp(order: Pick<Order, "method" | "payment_mode">, event: OrderNotice) {
  return event === "preparing" || event === "completed" || event === "event_morning" || event === "event_evening"
    || (event === "ready" && order.method !== "pickup")
    || (event === "paid" && order.payment_mode === "manual");
}

export function whatsappNoticeMessage(order: Order, event: OrderNotice, origin: string) {
  if (skippedOnWhatsapp(order, event)) return null;
  if (event === "pix_available") {
    if (!order.checkout_url || order.paid_at) return null;
    return `BLUECKYARDIGANS · Pedido #${order.id.slice(0, 8).toUpperCase()}\nSeu pedido ainda está aguardando o Pix. Se ainda quiser garantir seu hambúrguer, pague aqui: ${order.checkout_url}`;
  }
  return orderNoticeMessage(order, event, origin);
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
  const text = whatsappNoticeMessage(order, event, new URL(origin).origin);
  if (!text) return;
  await ensureSchema();
  const now = new Date().toISOString();
  const id = `${orderId}:${event}`;
  // O Pix só vira mensagem se o pagamento não cair dentro do prazo; o envio confere o pagamento antes.
  const sendAfter = event === "pix_available" ? new Date(Date.now() + whatsappPixReminderMinutes * 60_000).toISOString() : null;
  const result = await db().prepare("INSERT OR IGNORE INTO order_notifications (id,order_id,event,message,next_attempt_at,updated_at) VALUES (?,?,?,?,?,?)")
    .bind(id, orderId, event, text, sendAfter, now).run();
  if (!result.meta.changes) return;
  await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE order_id=? AND id<>? AND event NOT IN ('event_morning','event_evening') AND state IN ('pending','failed')")
    .bind(now, orderId, id).run();
  if (!sendAfter) await sendNotice(id);
}

/** Returns true when a message was submitted to Evolution (even if the answer was lost). */
async function sendNotice(id: string) {
  const config = settings();
  if (!config) return false;
  const now = new Date().toISOString();
  const lastAllowed = new Date(Date.now() - whatsappGap.minSeconds * 1000).toISOString();
  // A trava de intervalo fica no próprio claim, então dois envios simultâneos não passam juntos.
  // Se travar, a mensagem continua pendente e o agendamento envia depois.
  const claim = await db().prepare(`UPDATE order_notifications SET state='sending',attempts=attempts+1,updated_at=?
    WHERE id=? AND state IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=?)
      AND NOT EXISTS (SELECT 1 FROM order_notifications recent WHERE recent.state IN ('sending','accepted','uncertain')
        AND COALESCE(recent.accepted_at, recent.updated_at)>?)`)
    .bind(now, id, now, lastAllowed).run();
  if (!claim.meta.changes) return false;
  const notice = await db().prepare("SELECT * FROM order_notifications WHERE id=?").bind(id).first<NoticeRow>();
  if (!notice) return false;
  const order = await getOrder(notice.order_id, true);
  const number = order && phoneNumber(order);
  const expiredReminder = isEventReminder(notice.event) && (!eventReminderActive(notice.event, new Date(), order?.event_day) || !order?.paid_at || order.status === "completed");
  if (!order?.whatsapp_opt_in || order.contact_deleted_at || !number || order.status === "refunded" || (order.method === "pickup" && (order.status === "completed" || notice.event === "completed")) || expiredReminder || pixNoticeExpired(order, notice.event) || skippedOnWhatsapp(order, notice.event)) {
    await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return false;
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
    // A retirada pode ter sido concluída enquanto a Evolution verificava a conexão.
    if (order.method === "pickup") {
      const current = await getOrder(notice.order_id, true);
      if (!current || current.status === "completed" || current.status === "refunded" || !current.whatsapp_opt_in || current.contact_deleted_at) {
        await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
        return false;
      }
    }
    submitted = true;
    const response = await fetch(`${config.base}/message/sendText/${encodeURIComponent(config.instance)}`, {
      method: "POST", headers: {"Content-Type": "application/json", apikey: config.key},
      // "delay" mostra "digitando..." por alguns segundos antes da mensagem, como num envio feito à mão.
      body: JSON.stringify({number, text: notice.message, delay: 2_000 + Math.floor(Math.random() * 2_000)}), signal: AbortSignal.timeout(15_000),
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
    return true;
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(6, notice.attempts));
    const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    const uncertain = submitted && !rejected;
    const detail = error instanceof Error ? error.message : "Falha no envio";
    const prefix = uncertain ? "Confira o WhatsApp antes de reenviar. " : rejected ? "Rejeitado HTTP: " : "Antes do envio: ";
    const reason = `${prefix}${providerId ? `Mensagem ${providerId}. ` : ""}${detail}`.slice(0, 300);
    await db().prepare("UPDATE order_notifications SET state=?,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?")
      .bind(uncertain ? "uncertain" : "failed", uncertain ? null : retryAt, reason, new Date().toISOString(), id).run();
    return submitted;
  }
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function scheduleNotificationRetries() {
  if (!evolutionEnabled()) return;
  waitUntil(retryEvolutionNotifications().catch(error => console.error("Falha ao repetir avisos Evolution", error)));
}

/** `spaced` waits between messages. Only the cron run uses it: requests from the admin panel cannot stay open that long. */
export async function retryEvolutionNotifications({ spaced = false } = {}) {
  if (!evolutionEnabled()) return;
  await ensureNotificationSchema();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 60_000).toISOString();
  await db().prepare("UPDATE order_notifications SET state='uncertain',next_attempt_at=NULL,last_error=SUBSTR('Envio incerto; confira o WhatsApp antes de reenviar. ' || COALESCE(last_error,''),1,300),updated_at=? WHERE (state='sending' AND updated_at<=?) OR (state='failed' AND (last_error IS NULL OR (last_error NOT LIKE 'Antes do envio:%' AND last_error NOT LIKE 'Rejeitado HTTP:%')))")
    .bind(now, stale).run();
  await db().prepare("UPDATE order_notifications SET state='superseded',updated_at=? WHERE event='pix_available' AND state IN ('pending','failed') AND EXISTS (SELECT 1 FROM orders WHERE orders.id=order_notifications.order_id AND (paid_at IS NOT NULL OR status NOT IN ('ready_for_payment','awaiting_payment')))")
    .bind(now).run();
  const rows = await db().prepare("SELECT id FROM order_notifications WHERE state IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY COALESCE(next_attempt_at, updated_at) LIMIT ?")
    .bind(now, spaced ? notificationBatch.whatsapp : 1).all<{id: string}>();
  for (const [index, row] of rows.results.entries()) {
    const sent = await sendNotice(row.id);
    if (sent && index < rows.results.length - 1) await pause((whatsappGap.minSeconds + Math.random() * whatsappGap.jitterSeconds) * 1000);
  }
}
