import { db, getOrder, type Order } from "@/lib/store";
import { scheduleOrderNotifications } from "@/lib/order-notifications";

type HandoffResult = { order: Order } | { error: string; status: number };

export async function confirmHandoff(order: Order, code: unknown, origin: string): Promise<HandoffResult> {
  const expectedStatus = order.method === "delivery" ? "out_for_delivery" : "ready";
  if (!order.paid_at || order.status !== expectedStatus) {
    return { error: order.status === "completed" ? "Este pedido já foi concluído." : "O pedido precisa estar pago e pronto para entrega ou retirada.", status: 409 };
  }
  const now = new Date();
  if (order.handoff_locked_until && order.handoff_locked_until > now.toISOString()) {
    return { error: "Muitas tentativas. Aguarde 15 minutos ou peça ajuda ao administrador.", status: 429 };
  }
  const trimmedCode = String(code ?? "").trim();
  if (!/^\d{4}$/.test(trimmedCode)) return { error: "Informe os quatro últimos dígitos do telefone.", status: 400 };
  const digits = order.phone.replace(/\D/g, "");
  if (digits.length < 4 || order.contact_deleted_at) return { error: "Confirmação por telefone indisponível. Peça ajuda ao administrador.", status: 409 };
  if (trimmedCode !== digits.slice(-4)) {
    const attempts = (order.handoff_locked_until ? 0 : order.handoff_attempts) + 1;
    const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
    await db().prepare("UPDATE orders SET handoff_attempts=?,handoff_locked_until=? WHERE id=? AND status=?")
      .bind(attempts, lockedUntil, order.id, expectedStatus).run();
    return { error: lockedUntil ? "Muitas tentativas. Aguarde 15 minutos ou peça ajuda ao administrador." : "Código incorreto. Confira os quatro últimos dígitos do telefone do pedido.", status: lockedUntil ? 429 : 400 };
  }
  const timestamp = now.toISOString();
  const result = await db().prepare("UPDATE orders SET status='completed',handoff_confirmed_at=?,handoff_note=?,handoff_attempts=0,handoff_locked_until=NULL,updated_at=? WHERE id=? AND status=? AND paid_at IS NOT NULL AND (handoff_locked_until IS NULL OR handoff_locked_until<=?)")
    .bind(timestamp, "Confirmado com os quatro últimos dígitos do telefone", timestamp, order.id, expectedStatus, timestamp).run();
  if (!result.meta.changes) return { error: "O pedido mudou de situação. Atualize a página.", status: 409 };
  scheduleOrderNotifications(order.id, "completed", origin);
  return { order: (await getOrder(order.id))! };
}
