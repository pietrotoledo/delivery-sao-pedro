export type ItemWithRemovals = { name: string; quantity: number; removedIngredients?: string[]; unitRemovals?: string[][] };

export function orderItemLabels(item: ItemWithRemovals): string[] {
  if (item.unitRemovals?.length) return item.unitRemovals.map((removed, index) => `${item.name} ${index + 1}${removed.length ? ` — sem ${removed.join(", ").toLowerCase()}` : " — completo"}`);
  return [`${item.quantity}× ${item.name}${item.removedIngredients?.length ? ` — sem ${item.removedIngredients.join(", ").toLowerCase()}` : ""}`];
}
