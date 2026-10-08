import { createCheckout } from "@/lib/payment";
import { adminOnly, getOrder, json, paymentHandle, sameOrigin } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({ error: "Acesso restrito." }, 403);
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return json({ error: "Pedido não encontrado." }, 404);
  if (order.paid_at || order.status === "refunded") return json({ error: "Este pedido não aceita novo pagamento." }, 409);
  if (order.total === null) return json({ error: "Defina a taxa de entrega antes de gerar o Pix." }, 409);
  if (!paymentHandle()) return json({ error: "Configure a InfinitePay para gerar links reais." }, 409);
  if (order.checkout_url) return json({ url: order.checkout_url });
  try {
    const result = await createCheckout(order, new URL(request.url).origin);
    if (result.demo) return json({ error: "Pix indisponível neste ambiente." }, 409);
    return json({ url: result.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao gerar o Pix." }, 502);
  }
}
