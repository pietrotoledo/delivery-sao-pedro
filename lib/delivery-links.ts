export function deliveryDirectionsUrl(address: string, neighborhood: string | null) {
  const destination = [address, neighborhood, "João Pessoa, PB"].filter(Boolean).join(", ");
  const query = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${query}`;
}

export function deliveryPhoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}
