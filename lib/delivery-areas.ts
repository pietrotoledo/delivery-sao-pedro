// "combinar": a taxa é acertada com o motoboy pelo WhatsApp e não entra no Pix.
export type DeliveryFee = number | "combinar";

export const deliveryAreas: readonly { name: string; fee: DeliveryFee; city?: string }[] = [
  { name: "Manaíra", fee: 0 },
  { name: "Bessa", fee: 0 },
  { name: "Aeroclube", fee: 0 },
  { name: "Tambaú", fee: 0 },
  { name: "Jardim Oceania", fee: 0 },
  { name: "Bairro dos Estados", fee: 500 },
  { name: "Cabo Branco", fee: 500 },
  { name: "Pedro Gondim", fee: 500 },
  { name: "Tambauzinho", fee: 500 },
  { name: "Miramar", fee: 500 },
  { name: "Brisamar", fee: 500 },
  { name: "Altiplano", fee: 500 },
  { name: "Bancários", fee: "combinar" },
  { name: "Portal do Sol", fee: "combinar" },
  { name: "Intermares", fee: "combinar", city: "Cabedelo" },
];

// Pedidos com subtotal acima de R$ 60,00 têm frete grátis em qualquer bairro atendido.
export const freeDeliveryAbove = 6000;

export const deliveryAreaCity = (neighborhood: string) =>
  deliveryAreas.find(area => area.name === neighborhood)?.city ?? "João Pessoa";

export function deliveryFeeFor(neighborhood: string, subtotal = 0): DeliveryFee | null {
  const fee = deliveryAreas.find(area => area.name === neighborhood)?.fee ?? null;
  return fee !== null && subtotal > freeDeliveryAbove ? 0 : fee;
}
