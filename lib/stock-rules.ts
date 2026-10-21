import { comboDrinkProductId } from "./menu-options";

// Pedidos com Pix não pago devolvem o estoque depois deste prazo.
export const pendingPaymentMinutes = 30;
export const pendingStatuses = ["ready_for_payment", "awaiting_payment"] as const;
// Pedidos nestes status já devolveram o estoque e não contam no limite de hambúrgueres.
export const releasedStatuses = ["refunded", "expired"] as const;
const released = releasedStatuses.map(status => `'${status}'`).join(",");

// Produtos consumidos por um pedido: itens avulsos + bebidas incluídas nos combos.
export function stockRequirements(items: { id: string; quantity: number; unitDrinks?: string[] }[]) {
  const quantities = new Map<string, number>();
  const add = (id: string, quantity: number) => quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  for (const item of items) {
    add(item.id, item.quantity);
    for (const value of item.unitDrinks ?? []) {
      const drink = comboDrinkProductId(value);
      if (drink) add(drink, 1);
    }
  }
  return Array.from(quantities, ([id, quantity]) => ({ id, quantity })).filter(item => item.quantity > 0);
}

// Hambúrgueres reservados por pedidos pagos ou aguardando Pix.
export const reservedBurgersSql = `COALESCE((SELECT SUM(burger_count) FROM orders WHERE status NOT IN (${released})),0)`;
export const capacitySql = "COALESCE((SELECT capacity FROM settings WHERE id = 1),100)";
