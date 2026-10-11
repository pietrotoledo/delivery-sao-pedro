import { deliveryOnly } from "@/lib/delivery-auth";
import { confirmHandoff } from "@/lib/confirm-handoff";
import { getOrder, json, sameOrigin } from "@/lib/store";

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  if (!sameOrigin(request)) return json({error: "Origem inválida."}, 403);
  if (!await deliveryOnly(request)) return json({error: "Acesso restrito aos entregadores."}, 403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order || order.method !== "delivery") return json({error: "Pedido de entrega não encontrado."}, 404);
  let body: {code?: unknown};
  try { body = await request.json() as {code?: unknown}; }
  catch { return json({error: "Informe o código de quatro dígitos."}, 400); }
  const result = await confirmHandoff(order, body.code, new URL(request.url).origin);
  return "error" in result ? json({error: result.error}, result.status) : json({ok: true});
}
