import { adminOnly, config, db, ensureSchema, json, sameOrigin } from "@/lib/store";
import { eventDayOf } from "@/lib/event-schedule";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (value: unknown): value is string => typeof value === "string" && dayPattern.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

// Agenda um dia de vendas sem trocar o dia atual. Ele aparece na trajetória do painel até alguém começar a vender nele.
export async function POST(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const body = await request.json().catch(() => ({})) as {day?:unknown;capacity?:unknown};
  if (!validDay(body.day)) return json({error:"Escolha uma data válida para o dia de vendas."},400);
  if (body.day < eventDayOf(new Date())) return json({error:"Esse dia já passou. Escolha hoje ou uma data futura."},400);
  if (!Number.isInteger(body.capacity) || (body.capacity as number) < 1 || (body.capacity as number) > 10000) return json({error:"Informe um limite de hambúrgueres entre 1 e 10000."},400);
  await ensureSchema();
  await db().prepare("INSERT INTO event_days (day,capacity,opened_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET capacity=excluded.capacity")
    .bind(body.day, body.capacity, new Date().toISOString()).run();
  return json({ok:true});
}

// Muda a data ou o limite de um dia que ainda não tem pedidos. Se for o dia atual, o site passa a mostrar a nova data.
export async function PATCH(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const body = await request.json().catch(() => ({})) as {from?:unknown;day?:unknown;capacity?:unknown};
  if (!validDay(body.from) || !validDay(body.day)) return json({error:"Escolha uma data válida para o dia de vendas."},400);
  if (!Number.isInteger(body.capacity) || (body.capacity as number) < 1 || (body.capacity as number) > 10000) return json({error:"Informe um limite de hambúrgueres entre 1 e 10000."},400);
  const { from, day } = body as {from:string;day:string};
  const capacity = body.capacity as number;
  if (day !== from && day < eventDayOf(new Date())) return json({error:"Esse dia já passou. Escolha hoje ou uma data futura."},400);
  await ensureSchema();
  const current = await config();
  const orders = await db().prepare("SELECT COUNT(*) AS count FROM orders WHERE event_day = ?").bind(from).first<{count:number}>();
  if (day !== from && (orders?.count ?? 0) > 0) return json({error:"Esse dia já tem pedidos. Dá para mudar o limite, mas a data fica."},400);
  if (day !== from && await db().prepare("SELECT 1 AS hit FROM event_days WHERE day = ?").bind(day).first()) return json({error:"Já existe um dia de vendas nessa data."},400);
  const now = new Date().toISOString();
  const statements = [
    db().prepare("DELETE FROM event_days WHERE day = ?").bind(from),
    db().prepare("INSERT INTO event_days (day,capacity,opened_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET capacity=excluded.capacity").bind(day,capacity,now),
  ];
  if (from === current.currentDay) statements.push(db().prepare("INSERT INTO settings (id,capacity,paused,current_day) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET capacity=excluded.capacity,current_day=excluded.current_day").bind(capacity,current.paused?1:0,day));
  await db().batch(statements);
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
