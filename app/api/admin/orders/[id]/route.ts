import { adminOnly, db, getOrder, json, paymentHandle, sameOrigin } from "@/lib/store";

const statuses = ["paid","preparing","ready","out_for_delivery","completed"];

export async function PATCH(request: Request, context: {params:Promise<{id:string}>}) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order) return json({error:"Pedido não encontrado."},404);
  const body = await request.json() as {action?:string;fee?:number;status?:string;note?:string};
  const now = new Date().toISOString();
  if (body.action === "quote") {
    if (order.method !== "delivery" || order.paid_at || order.checkout_url || !Number.isInteger(body.fee) || body.fee! < 0 || body.fee! > 10000) return json({error:"Taxa inválida."},400);
    await db().prepare("UPDATE orders SET delivery_fee=?,total=?,status='ready_for_payment',updated_at=? WHERE id=?")
      .bind(body.fee,order.subtotal+body.fee!,now,id).run();
  } else if (body.action === "status") {
    if (!order.paid_at || !statuses.includes(body.status ?? "") || order.status === "refunded") return json({error:"Estado inválido."},400);
    await db().prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(body.status,now,id).run();
  } else if (body.action === "demo_paid") {
    if (paymentHandle() || order.total===null || order.paid_at) return json({error:"Simulação indisponível."},400);
    await db().prepare("UPDATE orders SET status='paid',payment_mode='demo',paid_at=?,updated_at=? WHERE id=?").bind(now,now,id).run();
  } else if (body.action === "refund") {
    const note = String(body.note??"").trim().slice(0,300);
    if (!order.paid_at || order.status==="refunded" || !note) return json({error:"Registre o motivo e devolva o valor antes de marcar como reembolsado."},400);
    await db().prepare("UPDATE orders SET status='refunded',refund_note=?,updated_at=? WHERE id=?").bind(note,now,id).run();
  } else return json({error:"Ação inválida."},400);
  return json({ok:true});
}
