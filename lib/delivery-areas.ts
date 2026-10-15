export const deliveryAreas = [
  { name: "Aeroclube", fee: 0 },
  { name: "Bairro dos Estados", fee: 0 },
  { name: "Pedro Gondim", fee: 0 },
  { name: "Tambauzinho", fee: 0 },
  { name: "Miramar", fee: 0 },
  { name: "Manaíra", fee: 0 },
  { name: "Altiplano", fee: 500 },
  { name: "Cabo Branco", fee: 500 },
  { name: "Bessa", fee: 500 },
  { name: "Tambaú", fee: 500 },
] as const;

export function deliveryFeeFor(neighborhood: string): number | null {
  return deliveryAreas.find(area => area.name === neighborhood)?.fee ?? null;
}
