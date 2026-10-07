import { adminOnly, config, db, ensureSchema, json, paidCount, paymentHandle } from "@/lib/store";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({error:"Acesso restrito."},403);
  await ensureSchema();
  const [settings,paid,orders] = await Promise.all([
    config(), paidCount(),
    db().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all(),
  ]);
  return json({orders:orders.results,settings,paid,demo:!paymentHandle()});
}
