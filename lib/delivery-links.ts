import { eventLocation, eventLocationMapUrl } from "./event-location";

export function navigationUrls(destination: string) {
  const mapsQuery = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  const wazeQuery = new URLSearchParams({ q: destination, navigate: "yes" });
  return {
    maps: destination === eventLocation.address ? eventLocationMapUrl : `https://www.google.com/maps/dir/?${mapsQuery}`,
    waze: `https://waze.com/ul?${wazeQuery}`,
  };
}

export function deliveryDestination(address: string, neighborhood: string | null) {
  return [address, neighborhood, "João Pessoa, PB"].filter(Boolean).join(", ");
}

export function deliveryDirectionsUrl(address: string, neighborhood: string | null) {
  return navigationUrls(deliveryDestination(address, neighborhood)).maps;
}

export function deliveryPhoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}
