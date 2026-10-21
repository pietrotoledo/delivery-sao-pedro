import { config, getProducts, json, paidCount, paymentHandle } from "@/lib/store";
import { includesBurger } from "@/lib/menu-options";
import { burgerAvailability, releaseExpiredOrders } from "@/lib/stock";
import { evolutionEnabled } from "@/lib/evolution-notifications";
import { emailEnabled } from "@/lib/email-notifications";

export async function GET() {
  await releaseExpiredOrders();
  const [settings, paid, products, burgers] = await Promise.all([config(), paidCount(), getProducts(), burgerAvailability()]);
  // Hambúrguer e combo dividem o limite geral de hambúrgueres definido no painel.
  const menu = products.map(product => {
    const stock = product.stock === null ? null : Math.max(0, product.stock);
    return { ...product, stock: includesBurger(product) ? Math.min(stock ?? burgers.left, burgers.left) : stock };
  });
  return json({ menu, ...settings, paid, burgersLeft: burgers.left, demo: !paymentHandle(), whatsappNotifications: evolutionEnabled(), emailNotifications: emailEnabled() });
}
