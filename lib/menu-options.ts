export function includesBurger(product: { category: string }) {
  return product.category === "burger" || product.category === "combo";
}

export const hamburgerIngredients = ["Carne de 140 g", "Queijo", "Cebola caramelizada", "Maionese"];
const comboDrinks = [
  { id: "coke", value: "Coca-Cola normal" },
  { id: "coke-zero", value: "Coca-Cola Zero" },
  { id: "guarana", value: "Guaraná" },
  { id: "sparkling-water", value: "Água com gás" },
] as const;

// Preserve saved cart/order values; product eligibility uses IDs, not editable names.
export const comboDrinkOptions: string[] = comboDrinks.map(drink => drink.value);
export const comboDrinkProductId = (value: string): string | undefined => comboDrinks.find(drink => drink.value === value)?.id;
export type ComboDrinkOption = { id: string; value: string; label: string; price: number };
type DrinkProduct = { id: string; category: string; name?: string; price: number; stock?: number | null; active?: boolean };

export function availableComboDrinks(products: readonly DrinkProduct[]): ComboDrinkOption[] {
  return comboDrinks.flatMap(drink => {
    const product = products.find(product => product.id === drink.id && product.category === "drink" && product.active !== false && (product.stock == null || product.stock > 0));
    return product ? [{ ...drink, label: product.name?.trim() || drink.value, price: product.price }] : [];
  });
}
