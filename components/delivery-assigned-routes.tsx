import { MapPinned, UserRound } from "lucide-react";
import { deliveryDestination } from "@/lib/delivery-links";
import { deliveryRouteLinks, type RouteOrder } from "@/lib/delivery-routing";

type AssignedOrder = RouteOrder & { routeId?: string | null; driverName?: string | null; routePosition?: number | null };

export default function DeliveryAssignedRoutes({ orders, busy, onRelease, onReassign }: { orders: AssignedOrder[]; busy: boolean; onRelease: (id: string) => void; onReassign?: (id: string) => void }) {
  const grouped = new Map<string, AssignedOrder[]>();
  for (const order of orders) {
    if (order.routeId) grouped.set(order.routeId, [...(grouped.get(order.routeId) ?? []), order]);
  }
  const routes = [...grouped.entries()].filter(([, members]) => members.some(order => order.status !== "completed"));
  if (!routes.length) return null;
  return <section className="delivery-assigned-routes" aria-labelledby="assigned-routes-title">
    <h2 id="assigned-routes-title">Rotas dos entregadores</h2>
    {routes.map(([id, members]) => {
      const stops = [...members].sort((a, b) => (a.routePosition ?? 0) - (b.routePosition ?? 0));
      const completed = stops.filter(order => order.status === "completed").length;
      const firstPending = stops.findIndex(order => order.status !== "completed");
      const previous = firstPending > 0 ? stops[firstPending - 1] : null;
      const origin = previous?.address ? deliveryDestination(previous.address, previous.neighborhood) : undefined;
      const links = deliveryRouteLinks(stops, origin);
      return <article className="delivery-route-planner" key={id}>
        <div className="delivery-route-heading"><UserRound size={23} aria-hidden="true" /><h3>{stops[0].driverName}</h3></div>
        <p>Rota #{id.slice(0, 6).toUpperCase()} · {completed} de {stops.length} entregas concluídas</p>
        <ol className="delivery-route-stops">{stops.map(order => <li key={order.id}><a href={`/entregas/pedido/${encodeURIComponent(order.id)}`}>{order.neighborhood || "Bairro não informado"} · #{order.id.slice(0, 8).toUpperCase()}{order.status === "completed" ? " · Entregue" : ""}</a></li>)}</ol>
        {links.length > 1 && <p className="delivery-route-note">Abra os trechos em ordem. Cada trecho leva até quatro entregas no Maps.</p>}
        <div className="delivery-route-actions">{links.map((part, index) => <a key={part.orders[0].id} className="button button-yellow" href={part.url} target="_blank" rel="noopener noreferrer"><MapPinned size={18} aria-hidden="true" />{links.length === 1 ? "Abrir rota no Google Maps" : `Abrir trecho ${index + 1}`}</a>)}</div>
        <button className="delivery-route-release" type="button" disabled={busy} onClick={() => onRelease(id)}>Liberar entregas pendentes desta rota</button>
        {onReassign && <button className="delivery-route-release" type="button" disabled={busy} onClick={() => onReassign(id)}>Trocar entregador</button>}
      </article>;
    })}
  </section>;
}
