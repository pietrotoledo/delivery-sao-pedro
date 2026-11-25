import { adminOnly, config, db, ensureSchema, json, paymentHandle } from "@/lib/store";
import { ensureDeliveryRouteSchema } from "@/lib/delivery-route-assignments";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({error:"Acesso restrito."},403);
  await ensureSchema();
  await ensureDeliveryRouteSchema();
  const settings = await config();
  // O painel mostra um dia por vez; sem escolha, abre no dia de vendas atual.
  const requested = new URL(request.url).searchParams.get("day") ?? "";
  const day = dayPattern.test(requested) ? requested : settings.currentDay;
  const [paid,orders,whatsappNotifications,emailNotifications,completed,days,dayCapacity,allTime] = await Promise.all([
    db().prepare("SELECT COALESCE(SUM(burger_count),0) AS count FROM orders WHERE paid_at IS NOT NULL AND status != 'refunded' AND event_day = ?").bind(day).first<{count:number}>(),
    db().prepare(`SELECT o.*,r.driver_name AS delivery_driver_name,r.id AS delivery_route_id
      FROM orders o LEFT JOIN delivery_route_orders ro ON ro.order_id=o.id
      LEFT JOIN delivery_routes r ON r.id=ro.route_id WHERE o.event_day = ? ORDER BY o.created_at DESC LIMIT 1000`).bind(day).all(),
    db().prepare("SELECT n.order_id,n.event,n.state,n.attempts,n.last_error,n.accepted_at FROM order_notifications n JOIN orders o ON o.id=n.order_id WHERE o.event_day = ? ORDER BY n.updated_at DESC LIMIT 1000").bind(day).all(),
    db().prepare("SELECT n.order_id,n.event,n.state,n.attempts,n.last_error,n.accepted_at FROM email_notifications n JOIN orders o ON o.id=n.order_id WHERE o.event_day = ? ORDER BY n.updated_at DESC LIMIT 1000").bind(day).all(),
    db().prepare("SELECT COALESCE(SUM(burger_count),0) AS count FROM orders WHERE status = 'completed' AND event_day = ?").bind(day).first<{count:number}>(),
    db().prepare(`SELECT day, SUM(count) AS orders FROM (
        SELECT event_day AS day, COUNT(*) AS count FROM orders GROUP BY event_day
        UNION ALL SELECT day, 0 FROM event_days
        UNION ALL SELECT ?, 0
      ) GROUP BY day ORDER BY day DESC`).bind(settings.currentDay).all<{day:string;orders:number}>(),
    db().prepare("SELECT capacity FROM event_days WHERE day = ?").bind(day).first<{capacity:number}>(),
    // Soma de todas as noites, para o faturamento geral no topo do painel.
    db().prepare("SELECT COALESCE(SUM(total),0) AS revenue, COUNT(DISTINCT event_day) AS nights FROM orders WHERE paid_at IS NOT NULL AND status != 'refunded'").first<{revenue:number;nights:number}>(),
  ]);
  const notifications = [
    ...whatsappNotifications.results.map(notice => ({ ...notice, channel: "whatsapp" })),
    ...emailNotifications.results.map(notice => ({ ...notice, channel: "email" })),
  ];
  const capacity = day === settings.currentDay ? settings.capacity : dayCapacity?.capacity ?? settings.capacity;
  return json({orders:orders.results,notifications,settings,day,dayCapacity:capacity,days:days.results,allTimeRevenue:allTime?.revenue ?? 0,nightsWithSales:allTime?.nights ?? 0,paid:paid?.count ?? 0,completedBurgers:completed?.count ?? 0,demo:!paymentHandle()});
}
