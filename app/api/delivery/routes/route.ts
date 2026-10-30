import { deliveryOnly } from "@/lib/delivery-auth";
import { adminOnly, db, ensureSchema, json, sameOrigin } from "@/lib/store";
import { ensureDeliveryRouteSchema } from "@/lib/delivery-route-assignments";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Acesso restrito à equipe." }, 403);
  const isAdmin = await adminOnly(request);
  if (!isAdmin && !await deliveryOnly(request)) return json({ error: "Acesso restrito à equipe." }, 403);
  const body = await request.json().catch(() => null) as { action?: string; driverName?: unknown; orderIds?: unknown; routeId?: unknown } | null;
  if (!body) return json({ error: "Informe os dados da rota." }, 400);
  await ensureSchema();
  await ensureDeliveryRouteSchema();
  const database = db();
  if (body.action === "release") {
    if (typeof body.routeId !== "string" || !body.routeId || body.routeId.length > 80) return json({ error: "Rota inválida." }, 400);
    await database.batch([
      // As entregas já concluídas guardam o nome do responsável no histórico.
      database.prepare(`DELETE FROM delivery_route_orders WHERE route_id=?
        AND order_id IN (SELECT id FROM orders WHERE status<>'completed')`).bind(body.routeId),
      database.prepare("UPDATE delivery_routes SET released_at=? WHERE id=? AND released_at IS NULL").bind(new Date().toISOString(), body.routeId),
    ]);
    return json({ ok: true });
  }
  const driverName = typeof body.driverName === "string" ? body.driverName.trim().replace(/\s+/g, " ") : "";
  if (driverName.length < 2 || driverName.length > 60 || /[\u0000-\u001f]/.test(driverName)) return json({ error: "Informe o nome do entregador, entre 2 e 60 caracteres." }, 400);
  if (body.action === "reassign") {
    if (!isAdmin) return json({ error: "Somente o administrador pode trocar o entregador." }, 403);
    if (typeof body.routeId !== "string" || !body.routeId || body.routeId.length > 80) return json({ error: "Rota inválida." }, 400);
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const pending = `order_id IN (SELECT id FROM orders WHERE method='delivery' AND paid_at IS NOT NULL
      AND contact_deleted_at IS NULL AND status IN ('paid','preparing','ready','out_for_delivery'))`;
    const results = await database.batch([
      database.prepare(`INSERT INTO delivery_routes (id,driver_name,created_at) SELECT ?,?,?
        WHERE EXISTS (SELECT 1 FROM delivery_routes WHERE id=? AND released_at IS NULL)
        AND EXISTS (SELECT 1 FROM delivery_route_orders WHERE route_id=? AND ${pending})`).bind(newId, driverName, now, body.routeId, body.routeId),
      // Só as pendentes mudam; entregas concluídas preservam o responsável original.
      database.prepare(`UPDATE delivery_route_orders SET route_id=? WHERE route_id=? AND ${pending}
        AND EXISTS (SELECT 1 FROM delivery_routes WHERE id=?)`).bind(newId, body.routeId, newId),
      database.prepare(`UPDATE delivery_routes SET released_at=? WHERE id=?
        AND EXISTS (SELECT 1 FROM delivery_routes WHERE id=?)`).bind(now, body.routeId, newId),
    ]);
    return results[0].meta.changes ? json({ ok: true, routeId: newId }) : json({ error: "A rota já foi liberada ou concluída. Atualize a lista." }, 409);
  }
  if (body.action !== "claim") return json({ error: "Ação inválida." }, 400);
  const ids = body.orderIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 40 || ids.some(id => typeof id !== "string" || !id || id.length > 80) || new Set(ids).size !== ids.length) return json({ error: "Selecione de 1 a 40 entregas diferentes." }, 400);
  const routeId = crypto.randomUUID();
  const placeholders = ids.map(() => "?").join(",");
  // O lote é transacional: se outro entregador já pegou um pedido, nenhum é atribuído.
  const results = await database.batch([
    database.prepare(`INSERT INTO delivery_routes (id,driver_name,created_at)
      SELECT ?,?,? WHERE (SELECT COUNT(*) FROM orders o WHERE o.id IN (${placeholders})
        AND o.method='delivery' AND o.paid_at IS NOT NULL AND o.contact_deleted_at IS NULL
        AND o.status IN ('ready','out_for_delivery') AND LENGTH(TRIM(COALESCE(o.address,'')))>0
        AND NOT EXISTS (SELECT 1 FROM delivery_route_orders r WHERE r.order_id=o.id))=?`)
      .bind(routeId, driverName, new Date().toISOString(), ...ids, ids.length),
    ...ids.map((id, index) => database.prepare(`INSERT INTO delivery_route_orders (order_id,route_id,position)
      SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM delivery_routes WHERE id=?)`).bind(id, routeId, index + 1, routeId)),
  ]);
  if (!results[0].meta.changes) return json({ error: "Uma das entregas já está com outro entregador ou mudou de status. Atualize a lista e selecione novamente." }, 409);
  return json({ ok: true, routeId }, 201);
}
