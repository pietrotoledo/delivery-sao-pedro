import { deliveryAreaCity } from "./delivery-areas";
import { eventLocation, eventLocationMapUrl } from "./event-location";

export function navigationUrls(destination: string) {
  const mapsQuery = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  const wazeQuery = new URLSearchParams({ q: destination, navigate: "yes" });
  return {
    maps: destination === eventLocation.address ? eventLocationMapUrl : `https://www.google.com/maps/dir/?${mapsQuery}`,
    waze: `https://waze.com/ul?${wazeQuery}`,
  };
}

// Endereços estruturados já trazem bairro e cidade; pedidos antigos só trazem rua e número.
export function addressWithNeighborhood(address: string | null, neighborhood: string | null) {
  if (!address) return neighborhood ?? "";
  return neighborhood && !address.includes(neighborhood) ? `${address} · ${neighborhood}` : address;
}

export function deliveryDestination(address: string, neighborhood: string | null) {
  const city = deliveryAreaCity(neighborhood ?? "");
  const street = address.split(" · ").filter(part => !part.startsWith("Referência:")).join(", ");
  return [street, neighborhood && !address.includes(neighborhood) ? neighborhood : null, address.includes(city) ? null : `${city}, PB`].filter(Boolean).join(", ");
}

export function deliveryDirectionsUrl(address: string, neighborhood: string | null) {
  return navigationUrls(deliveryDestination(address, neighborhood)).maps;
}

export function deliveryPhoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}

export function deliveryWhatsappHref(phone: string, orderId: string, driverName?: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(number)) return null;
  const message = `Olá! ${driverName?.trim() ? `Sou ${driverName.trim()}, entregador` : "Sou da equipe de entregas"} da Blueckyardigans. Estou entrando em contato sobre seu pedido #${orderId.slice(0, 8).toUpperCase()}.`;
  return `https://wa.me/${number}?${new URLSearchParams({ text: message })}`;
}
