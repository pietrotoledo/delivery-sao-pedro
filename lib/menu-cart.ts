import { availableComboDrinks, includesBurger } from "./menu-options";

export type MenuProduct = {
  id: string; name: string; price: number; category: string; description: string;
  imageUrl: string | null; stock: number | null; ingredients?: string[];
};
export type MenuCart = {
  quantities: Record<string, number>;
  comboDrinks: Record<string, string[]>;
  removals: Record<string, string[][]>;
};
export const emptyMenuCart = (): MenuCart => ({ quantities: {}, comboDrinks: {}, removals: {} });
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const menuBurgerCount = (cart: MenuCart, products: MenuProduct[]) => products.reduce((sum, product) => sum + (includesBurger(product) ? cart.quantities[product.id] ?? 0 : 0), 0);

export function restoreMenuCart(products: MenuProduct[], quantities: unknown, drinks: unknown, removals: unknown): MenuCart {
  const cart = emptyMenuCart();
  const savedQuantities = record(quantities), savedDrinks = record(drinks), savedRemovals = record(removals);
  const availableDrinks = new Set(availableComboDrinks(products).map(drink => drink.value));
  let burgersLeft = 20;
  for (const product of products) {
    const quantity = Math.max(0, Math.min(20, product.stock ?? 20, includesBurger(product) ? burgersLeft : 20, Math.floor(Number(savedQuantities[product.id]) || 0)));
    cart.quantities[product.id] = quantity;
    if (includesBurger(product)) burgersLeft -= quantity;
    const units = savedRemovals[product.id];
    if (includesBurger(product)) cart.removals[product.id] = Array.from({length: quantity}, (_, index) => {
      const unit = Array.isArray(units) ? units[index] : [];
      return Array.isArray(unit) ? [...new Set(unit.filter((ingredient): ingredient is string => typeof ingredient === "string" && Boolean(product.ingredients?.includes(ingredient))))] : [];
    });
    if (product.category === "combo") {
      const choices = savedDrinks[product.id];
      cart.comboDrinks[product.id] = Array.from({length: quantity}, (_, index) => Array.isArray(choices) && availableDrinks.has(choices[index]) ? choices[index] : "");
    }
  }
  return cart;
}

export function changeMenuQuantity(cart: MenuCart, products: MenuProduct[], id: string, delta: number): MenuCart {
  const product = products.find(item => item.id === id);
  if (!product || ![-1, 1].includes(delta) || (delta > 0 && product.category === "combo")) return cart;
  if (delta > 0 && includesBurger(product) && menuBurgerCount(cart, products) >= 20) return cart;
  const current = cart.quantities[id] ?? 0;
  const quantity = Math.max(0, Math.min(20, product.stock ?? 20, current + delta));
  if (quantity === current) return cart;
  const removals = Array.from({length: quantity}, (_, index) => cart.removals[id]?.[index] ?? []);
  return { quantities: {...cart.quantities, [id]: quantity}, removals: {...cart.removals, [id]: removals}, comboDrinks: {...cart.comboDrinks, ...(product.category === "combo" ? {[id]: (cart.comboDrinks[id] ?? []).slice(0, quantity)} : {})} };
}

export function addMenuCombo(cart: MenuCart, products: MenuProduct[], id: string, drink: string): MenuCart {
  const product = products.find(item => item.id === id && item.category === "combo");
  const current = cart.quantities[id] ?? 0;
  if (!product || !availableComboDrinks(products).some(option => option.value === drink) || current >= Math.min(20, product.stock ?? 20) || menuBurgerCount(cart, products) >= 20) return cart;
  return {
    quantities: {...cart.quantities, [id]: current + 1},
    removals: {...cart.removals, [id]: [...Array.from({length: current}, (_, index) => cart.removals[id]?.[index] ?? []), []]},
    comboDrinks: {...cart.comboDrinks, [id]: [...Array.from({length: current}, (_, index) => cart.comboDrinks[id]?.[index] ?? ""), drink]},
  };
}

export function upgradeMenuBurger(cart: MenuCart, products: MenuProduct[], burgerId: string, comboId: string, drink: string): MenuCart {
  const burger = products.find(item => item.id === burgerId && item.category === "burger");
  const combo = products.find(item => item.id === comboId && item.category === "combo");
  const burgerQuantity = cart.quantities[burgerId] ?? 0, comboQuantity = cart.quantities[comboId] ?? 0;
  if (!burger || !combo || burgerQuantity < 1 || !availableComboDrinks(products).some(option => option.value === drink) || comboQuantity >= Math.min(20, combo.stock ?? 20)) return cart;
  return {
    quantities: {...cart.quantities, [burgerId]: burgerQuantity - 1, [comboId]: comboQuantity + 1},
    removals: {...cart.removals, [burgerId]: (cart.removals[burgerId] ?? []).slice(0, burgerQuantity - 1), [comboId]: [...Array.from({length: comboQuantity}, (_, index) => cart.removals[comboId]?.[index] ?? []), cart.removals[burgerId]?.[burgerQuantity - 1] ?? []]},
    comboDrinks: {...cart.comboDrinks, [comboId]: [...Array.from({length: comboQuantity}, (_, index) => cart.comboDrinks[comboId]?.[index] ?? ""), drink]},
  };
}
