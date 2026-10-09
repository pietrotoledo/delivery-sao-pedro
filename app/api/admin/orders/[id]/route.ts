import { createCheckout } from "@/lib/payment";
import { adminOnly, db, getOrder, json, orderItems, paymentHandle, sameOrigin } from "@/lib/store";
import { scheduleOrderNotifications, type OrderNotice } from "@/lib/order-notifications";

const statuses = ["paid","preparing","ready","out_for_delivery"];

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
    if (paymentHandle()) {
      try {
        const updated = await getOrder(id);
        if (updated) await createCheckout(updated, new URL(request.url).origin);
      } catch {
        // A taxa está salva; o link também pode ser gerado depois na página do pedido.
      }
    }
  } else if (body.action === "status") {
    if (!order.paid_at || !statuses.includes(body.status ?? "") || ["refunded", "completed"].includes(order.status) || (order.method === "pickup" && body.status === "out_for_delivery")) return json({error:"Estado inválido."},400);
    const changed = await db().prepare("UPDATE orders SET status=?,updated_at=? WHERE id=? AND status<>?").bind(body.status,now,id,body.status).run();
    if (changed.meta.changes && ["preparing", "ready", "out_for_delivery"].includes(body.status!)) {
      scheduleOrderNotifications(id, body.status as OrderNotice, new URL(request.url).origin);
    }
  } else if (body.action === "manual_handoff") {
    const note = String(body.note ?? "").trim().slice(0, 300);
    const expected = order.method === "delivery" ? "out_for_delivery" : "ready";
    if (!order.paid_at || order.status !== expected || !note) return json({error:"Informe o motivo para concluir um pedido pago e pronto para entrega ou retirada."},400);
    const result = await db().prepare("UPDATE orders SET status='completed',handoff_confirmed_at=?,handoff_note=?,updated_at=? WHERE id=? AND status=? AND paid_at IS NOT NULL")
      .bind(now,`Confirmação manual: ${note}`,now,id,expected).run();
    if (!result.meta.changes) return json({error:"Este pedido já foi atualizado. Recarregue o painel."},409);
    scheduleOrderNotifications(id, "completed", new URL(request.url).origin);
  } else if (body.action === "demo_paid") {
    if (paymentHandle() || order.total===null || order.paid_at) return json({error:"Simulação indisponível."},400);
    await db().prepare("UPDATE orders SET status='paid',payment_mode='demo',paid_at=?,updated_at=? WHERE id=?").bind(now,now,id).run();
  } else if (body.action === "manual_paid") {
    const note = String(body.note ?? "").trim().slice(0, 300);
    if (!note || order.total === null || order.paid_at || order.status === "refunded" || !["ready_for_payment", "awaiting_payment"].includes(order.status)) {
      return json({error:"Confirme um pagamento pendente e informe a referência do recebimento."},400);
    }
    const result = await db().prepare("UPDATE orders SET status='paid',payment_mode='manual',payment_note=?,paid_at=?,updated_at=? WHERE id=? AND paid_at IS NULL AND status IN ('ready_for_payment','awaiting_payment')")
      .bind(note,now,now,id).run();
    if (!result.meta.changes) return json({error:"Este pedido já foi atualizado. Recarregue o painel."},409);
    scheduleOrderNotifications(id, "paid", new URL(request.url).origin);
  } else if (body.action === "refund") {
    const note = String(body.note??"").trim().slice(0,300);
    if (!order.paid_at || order.status==="refunded" || !note) return json({error:"Registre o motivo e devolva o valor antes de marcar como reembolsado."},400);
    await db().prepare("UPDATE orders SET status='refunded',refund_note=?,updated_at=? WHERE id=?").bind(note,now,id).run();
  } else return json({error:"Ação inválida."},400);
  return json({ok:true});
}

export async function DELETE(request: Request, context: {params:Promise<{id:string}>}) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order) return json({error:"Pedido não encontrado."},404);
  const database = db();
  const unpaid = !order.paid_at;
  const statements = unpaid ? [
    ...orderItems(order).map(item => database.prepare("UPDATE products SET stock=stock+?,updated_at=? WHERE id=? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id=? AND paid_at IS NULL)")
      .bind(item.quantity,new Date().toISOString(),item.id,id)),
    database.prepare("DELETE FROM orders WHERE id=? AND paid_at IS NULL").bind(id),
  ] : [database.prepare("DELETE FROM orders WHERE id=? AND paid_at IS NOT NULL").bind(id)];
  const results = await database.batch(statements);
  if (!results.at(-1)?.meta.changes) return json({error:"O pagamento deste pedido mudou. Atualize o painel e tente novamente."},409);
  return json({ok:true});
}
