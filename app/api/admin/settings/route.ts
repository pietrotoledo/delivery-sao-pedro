import { adminOnly, config, db, ensureSchema, json, sameOrigin } from "@/lib/store";
import { eventDayOf } from "@/lib/event-schedule";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (value: unknown): value is string => typeof value === "string" && dayPattern.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

export async function PATCH(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({error:"Acesso restrito."},403);
  const body = await request.json() as {capacity?:number;paused?:boolean;currentDay?:string};
  if (!Number.isInteger(body.capacity) || body.capacity! < 1 || body.capacity! > 10000 || typeof body.paused !== "boolean") {
    return json({error:"Configuração inválida."},400);
  }
  if (body.currentDay !== undefined && !validDay(body.currentDay)) return json({error:"Escolha uma data válida para o dia de vendas."},400);
  await ensureSchema();
  const current = await config();
  const day = body.currentDay ?? current.currentDay;
  if (day !== current.currentDay && day < eventDayOf(new Date())) return json({error:"Esse dia já passou. Só dá para vender hoje ou numa data futura."},400);
  const now = new Date().toISOString();
  // Guarda o limite de cada dia: o dia que fecha mantém o limite dele no relatório.
  await db().batch([
    db().prepare("INSERT INTO event_days (day,capacity,opened_at) VALUES (?,?,?) ON CONFLICT(day) DO NOTHING").bind(current.currentDay,current.capacity,now),
    db().prepare("INSERT INTO settings (id,capacity,paused,current_day) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET capacity=excluded.capacity,paused=excluded.paused,current_day=excluded.current_day")
      .bind(body.capacity,body.paused?1:0,day),
    db().prepare("INSERT INTO event_days (day,capacity,opened_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET capacity=excluded.capacity").bind(day,body.capacity,now),
  ]);
  return json({ok:true});
}
