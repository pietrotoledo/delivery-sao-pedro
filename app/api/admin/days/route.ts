import { adminOnly, config, db, ensureSchema, json, sameOrigin } from "@/lib/store";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (value: unknown): value is string => typeof value === "string" && dayPattern.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

// Agenda um dia de vendas sem trocar o dia atual. Ele aparece na trajetória do painel até alguém começar a vender nele.
export async function POST(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const body = await request.json().catch(() => ({})) as {day?:unknown;capacity?:unknown};
  if (!validDay(body.day)) return json({error:"Escolha uma data válida para o dia de vendas."},400);
  if (!Number.isInteger(body.capacity) || (body.capacity as number) < 1 || (body.capacity as number) > 10000) return json({error:"Informe um limite de hambúrgueres entre 1 e 10000."},400);
  await ensureSchema();
  await db().prepare("INSERT INTO event_days (day,capacity,opened_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET capacity=excluded.capacity")
    .bind(body.day, body.capacity, new Date().toISOString()).run();
  return json({ok:true});
}

// Remove um dia agendado por engano. Dias com pedidos ou o dia atual ficam guardados.
export async function DELETE(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const day = new URL(request.url).searchParams.get("day") ?? "";
  if (!validDay(day)) return json({error:"Dia inválido."},400);
  await ensureSchema();
  const { currentDay } = await config();
  if (day === currentDay) return json({error:"Esse é o dia de vendas atual. Comece a vender em outro dia antes de removê-lo."},400);
  const orders = await db().prepare("SELECT COUNT(*) AS count FROM orders WHERE event_day = ?").bind(day).first<{count:number}>();
  if ((orders?.count ?? 0) > 0) return json({error:"Esse dia já tem pedidos e fica guardado para o relatório."},400);
  await db().prepare("DELETE FROM event_days WHERE day = ?").bind(day).run();
  return json({ok:true});
}
