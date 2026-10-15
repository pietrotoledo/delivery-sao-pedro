export type ItemWithRemovals = { name: string; quantity: number; removedIngredients?: string[]; unitRemovals?: string[][]; unitDrinks?: string[] };

export function orderItemLabels(item: ItemWithRemovals): string[] {
  if (item.unitRemovals?.length || item.unitDrinks?.length) return Array.from({length: item.quantity}, (_, index) => {
    const removed = item.unitRemovals?.[index] ?? [];
    return `${item.name} ${index + 1}${removed.length ? ` — sem ${removed.join(", ").toLowerCase()}` : " — completo"}${item.unitDrinks?.[index] ? ` — ${item.unitDrinks[index]}` : ""}`;
  });
  return [`${item.quantity}× ${item.name}${item.removedIngredients?.length ? ` — sem ${item.removedIngredients.join(", ").toLowerCase()}` : ""}`];
}
