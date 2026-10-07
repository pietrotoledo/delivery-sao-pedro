/** Remoções permitidas por produto; não há adicionais. */
export const burgerRemovals: Record<string, readonly string[]> = {
  classic: ["Queijo", "Alface", "Tomate", "Molho da casa"],
  bacon: ["Queijo", "Bacon", "Molho da casa"],
};
export function allowedRemovals(id: string): readonly string[] {
  return burgerRemovals[id] ?? [];
}
