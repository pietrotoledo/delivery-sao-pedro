import { createCheckout } from "@/lib/payment";
import { getOrder, json, sameOrigin } from "@/lib/store";

export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  if (!sameOrigin(request)) return json({error:"Origem inválida."},403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order) return json({error:"Pedido não encontrado."},404);
  if (order.paid_at || order.status === "refunded") return json({error:"Este pedido não aceita novo pagamento."},409);
  if (order.total === null) return json({error:"A taxa de entrega ainda não foi definida."},409);
  if (order.checkout_url) return json({demo:false,url:order.checkout_url});
  try { return json(await createCheckout(order,new URL(request.url).origin)); }
  catch(error) { return json({error:error instanceof Error?error.message:"Falha ao gerar Pix."},502); }
}
