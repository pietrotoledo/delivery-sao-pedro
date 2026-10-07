import { getOrder, json, publicOrder } from "@/lib/store";

export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order) return json({error:"Pedido não encontrado."},404);
  return json({order:publicOrder(order)});
}
