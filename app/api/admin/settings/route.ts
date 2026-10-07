import { adminOnly, db, ensureSchema, json, sameOrigin } from "@/lib/store";

export async function PATCH(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const body = await request.json() as {capacity?:number;paused?:boolean};
  if (!Number.isInteger(body.capacity) || body.capacity! < 1 || body.capacity! > 10000 || typeof body.paused !== "boolean") {
    return json({error:"Configuração inválida."},400);
  }
  await ensureSchema();
  await db().prepare("INSERT INTO settings (id,capacity,paused) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET capacity=excluded.capacity,paused=excluded.paused")
    .bind(body.capacity,body.paused?1:0).run();
  return json({ok:true});
}
