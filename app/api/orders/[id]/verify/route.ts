import { verifyPayment } from "@/lib/payment";
import { getOrder, json, sameOrigin } from "@/lib/store";

export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  if (!sameOrigin(request)) return json({error:"Origem inválida."},403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order) return json({error:"Pedido não encontrado."},404);
  if (order.paid_at) return json({paid:true});
  const body = await request.json() as {transaction_nsu?:string;slug?:string};
  const paid = await verifyPayment({order_nsu:id,transaction_nsu:body.transaction_nsu,slug:body.slug});
  return json({paid});
}
