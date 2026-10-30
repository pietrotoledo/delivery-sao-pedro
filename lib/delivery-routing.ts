import { deliveryDestination } from "./delivery-links";
import { eventLocation } from "./event-location";

export type RoutePoint = { lat: number; lng: number };
export type RouteOrder = { id: string; neighborhood: string | null; address: string | null; status: string };

// Centros aproximados dos polígonos municipais: https://github.com/paulovitorweb/geodata-jp/blob/main/data/bairros.geojson
// Intermares: ponto de referência da praia publicado pelo Ibama (2019).
// https://www.ibama.gov.br/phocadownload/notas/2019/2019-10-08_LOCALIDADES_AFETADAS_geral.pdf
// Estes pontos agrupam bairros; a navegação usa o endereço completo de cada pedido.
export const neighborhoodPoints: Readonly<Record<string, RoutePoint>> = {
  "Manaíra": { lat: -7.105051, lng: -34.835136 },
  "Bessa": { lat: -7.067171, lng: -34.843464 },
  "Aeroclube": { lat: -7.087265, lng: -34.843 },
  "Tambaú": { lat: -7.115326, lng: -34.826863 },
  "Jardim Oceania": { lat: -7.082635, lng: -34.835516 },
  "Bairro dos Estados": { lat: -7.114406, lng: -34.856201 },
  "Cabo Branco": { lat: -7.132125, lng: -34.820958 },
  "Pedro Gondim": { lat: -7.114854, lng: -34.846036 },
  "João Agripino": { lat: -7.106886, lng: -34.843374 },
  "Tambauzinho": { lat: -7.123829, lng: -34.847036 },
  "Miramar": { lat: -7.121574, lng: -34.835624 },
  "Brisamar": { lat: -7.114777, lng: -34.83933 },
  "Altiplano": { lat: -7.135093, lng: -34.828689 },
  "Bancários": { lat: -7.14616, lng: -34.836107 },
  "Portal do Sol": { lat: -7.152119, lng: -34.812735 },
  "Intermares": { lat: -7.042564, lng: -34.840547 },
};
export const defaultRoutePoint = neighborhoodPoints["Manaíra"];

export function neighborhoodDistance(neighborhood: string | null, origin: RoutePoint): number {
  const point = neighborhood ? neighborhoodPoints[neighborhood] : undefined;
  if (!point) return Infinity;
  const radians = Math.PI / 180;
  const lat = (point.lat - origin.lat) * radians;
  const lng = (point.lng - origin.lng) * radians;
  const a = Math.sin(lat / 2) ** 2 + Math.cos(origin.lat * radians) * Math.cos(point.lat * radians) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function sortByNeighborhood<T extends RouteOrder>(orders: readonly T[], origin: RoutePoint): T[] {
  return [...orders].sort((a, b) => {
    const da = neighborhoodDistance(a.neighborhood, origin), db = neighborhoodDistance(b.neighborhood, origin);
    return da === db ? 0 : da < db ? -1 : 1;
  });
}

export const canJoinRoute = (order: RouteOrder) =>
  ["ready", "out_for_delivery"].includes(order.status) && Boolean(order.address?.trim());

// Vizinho mais próximo por bairro, preservando a ordem original dentro do mesmo bairro.
export function planDeliveryRoute<T extends RouteOrder>(orders: readonly T[], origin: RoutePoint): T[] {
  let remaining = orders.filter(canJoinRoute);
  let point = origin;
  const result: T[] = [];
  while (remaining.length) {
    remaining = sortByNeighborhood(remaining, point);
    const next = remaining.shift()!;
    result.push(next);
    point = neighborhoodPoints[next.neighborhood ?? ""] ?? point;
  }
  return result;
}

export function deliveryRouteLinks(orders: readonly RouteOrder[], origin = eventLocation.address) {
  const links: { url: string; orders: RouteOrder[] }[] = [];
  let start = origin;
  let batch: RouteOrder[] = [];
  function urlFor(stops: RouteOrder[]) {
    const destinations = stops.map(order => deliveryDestination(order.address!, order.neighborhood));
    const params = new URLSearchParams({ api: "1", origin: start, destination: destinations.at(-1)!, travelmode: "driving" });
    if (destinations.length > 1) params.set("waypoints", destinations.slice(0, -1).join("|"));
    // Se dois endereços extensos não couberem, o próximo trecho parte da localização atual.
    if (stops.length === 1 && `https://www.google.com/maps/dir/?${params}`.length > 2048) params.delete("origin");
    return `https://www.google.com/maps/dir/?${params}`;
  }
  function flush() {
    if (!batch.length) return;
    links.push({ url: urlFor(batch), orders: batch });
    const last = batch.at(-1)!;
    start = deliveryDestination(last.address!, last.neighborhood);
    batch = [];
  }
  for (const order of orders.filter(canJoinRoute)) {
    // Navegadores móveis: até 3 paradas intermediárias, além do destino; URL até 2048 caracteres.
    if (batch.length && (batch.length === 4 || urlFor([...batch, order]).length > 2048)) flush();
    batch.push(order);
  }
  flush();
  return links;
}
