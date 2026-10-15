export function includesBurger(product: { category: string }) {
  return product.category === "burger" || product.category === "combo";
}

export const hamburgerIngredients = ["Carne de 140 g", "Queijo", "Cebola caramelizada", "Maionese"];
export const comboDrinkOptions = ["Coca-Cola normal", "Coca-Cola Zero", "Guaraná"];
