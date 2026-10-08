import { db, getOrder, handoffOnly, json, orderItems, sameOrigin, type Order } from "@/lib/store";
import { scheduleOrderNotice } from "@/lib/evolution-notifications";

function view(order: Order) {
  return {
    id: order.id, createdAt: order.created_at, name: order.name, method: order.method,
    neighborhood: order.neighborhood, address: order.address, notes: order.notes,
    items: orderItems(order), subtotal: order.subtotal, deliveryFee: order.delivery_fee,
    total: order.total, status: order.status, paidAt: order.paid_at,
    confirmedAt: order.handoff_confirmed_at,
    canConfirm: Boolean(order.paid_at) && order.status === (order.method === "delivery" ? "out_for_delivery" : "ready"),
  };
}

async function authorizedOrder(request: Request, id: string) {
  const token = new URL(request.url).searchParams.get("token");
  if (!await handoffOnly(id, token)) return null;
  return getOrder(id);
}

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  const order = await authorizedOrder(request, id);
  if (!order) return json({error: "Link da equipe inválido ou pedido não encontrado."}, 403);
  return json({order: view(order)});
}

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  if (!sameOrigin(request)) return json({error: "Origem inválida."}, 403);
  const {id} = await context.params;
  const order = await authorizedOrder(request, id);
  if (!order) return json({error: "Link da equipe inválido ou pedido não encontrado."}, 403);
  const expectedStatus = order.method === "delivery" ? "out_for_delivery" : "ready";
  if (!order.paid_at || order.status !== expectedStatus) {
    return json({error: order.status === "completed" ? "Este pedido já foi concluído." : "O pedido precisa estar pago e pronto para entrega ou retirada."}, 409);
  }
  const now = new Date();
  if (order.handoff_locked_until && order.handoff_locked_until > now.toISOString()) {
    return json({error: "Muitas tentativas. Aguarde 15 minutos ou peça ajuda ao administrador."}, 429);
  }
  let body: {code?: unknown};
  try { body = await request.json() as {code?: unknown}; }
  catch { return json({error: "Informe o código de quatro dígitos."}, 400); }
  const code = String(body.code ?? "").trim();
  if (!/^\d{4}$/.test(code)) return json({error: "Informe os quatro últimos dígitos do telefone."}, 400);
  const digits = order.phone.replace(/\D/g, "");
  if (digits.length < 4 || order.contact_deleted_at) return json({error: "Confirmação por telefone indisponível. Peça ajuda ao administrador."}, 409);
  if (code !== digits.slice(-4)) {
    const attempts = (order.handoff_locked_until ? 0 : order.handoff_attempts) + 1;
    const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
    await db().prepare("UPDATE orders SET handoff_attempts=?,handoff_locked_until=? WHERE id=? AND status=?")
      .bind(attempts, lockedUntil, id, expectedStatus).run();
    return json({error: lockedUntil ? "Muitas tentativas. Aguarde 15 minutos ou peça ajuda ao administrador." : "Código incorreto. Confira os quatro últimos dígitos do telefone do pedido."}, lockedUntil ? 429 : 400);
  }
  const timestamp = now.toISOString();
  const result = await db().prepare("UPDATE orders SET status='completed',handoff_confirmed_at=?,handoff_note=?,handoff_attempts=0,handoff_locked_until=NULL,updated_at=? WHERE id=? AND status=? AND paid_at IS NOT NULL AND (handoff_locked_until IS NULL OR handoff_locked_until<=?)")
    .bind(timestamp, "Confirmado com os quatro últimos dígitos do telefone", timestamp, id, expectedStatus, timestamp).run();
  if (!result.meta.changes) return json({error: "O pedido mudou de situação. Atualize a página."}, 409);
  scheduleOrderNotice(id, "completed", new URL(request.url).origin);
  return json({order: view((await getOrder(id))!)});
}
