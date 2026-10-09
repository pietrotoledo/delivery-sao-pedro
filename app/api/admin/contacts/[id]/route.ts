import { adminOnly, db, getOrder, json, sameOrigin } from "@/lib/store";

export async function DELETE(request: Request, context: {params:Promise<{id:string}>}) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order || order.contact_deleted_at) return json({error:"Contato não encontrado."},404);
  const now = new Date().toISOString();
  const [result] = await db().batch([
    db().prepare("UPDATE orders SET name='Contato removido',phone='',email=NULL,neighborhood=NULL,address=NULL,notes=NULL,contact_deleted_at=?,updated_at=? WHERE id=? AND contact_deleted_at IS NULL")
      .bind(now,now,id),
    db().prepare("DELETE FROM order_notifications WHERE order_id=?").bind(id),
    db().prepare("DELETE FROM email_notifications WHERE order_id=?").bind(id),
  ]);
  if (!result.meta.changes) return json({error:"Contato já removido."},409);
  return json({ok:true});
}
