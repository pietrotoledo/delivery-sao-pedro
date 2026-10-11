import { getOrder, handoffOnly, json, orderItems, sameOrigin, type Order } from "@/lib/store";
import { confirmHandoff } from "@/lib/confirm-handoff";

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
  let body: {code?: unknown};
  try { body = await request.json() as {code?: unknown}; }
  catch { return json({error: "Informe o código de quatro dígitos."}, 400); }
  const result = await confirmHandoff(order, body.code, new URL(request.url).origin);
  return "error" in result ? json({error: result.error}, result.status) : json({order: view(result.order)});
}
