import { db, getOrder, orderItems, paymentHandle, type Order } from "./store";
import { scheduleOrderNotice } from "./evolution-notifications";

type PaymentNotice = { order_nsu?: string; transaction_nsu?: string; invoice_slug?: string; slug?: string; capture_method?: string };

export async function verifyPayment(notice: PaymentNotice, origin?: string) {
  const handle = paymentHandle();
  if (!handle || !notice.order_nsu || !notice.transaction_nsu || !(notice.invoice_slug || notice.slug)) return false;
  const order = await getOrder(notice.order_nsu);
  if (!order || order.total === null || order.status === "refunded") return false;
  const response = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, order_nsu: order.id, transaction_nsu: notice.transaction_nsu, slug: notice.invoice_slug || notice.slug }),
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?:boolean;paid?:boolean;amount?:number;capture_method?:string };
  if (!result.success || !result.paid || result.capture_method !== "pix" || result.amount !== order.total) return false;
  const now = new Date().toISOString();
  const updated = await db().prepare("UPDATE orders SET status = 'paid', payment_mode = 'infinitepay', paid_at = ?, updated_at = ?, transaction_nsu = ?, invoice_slug = ? WHERE id = ? AND paid_at IS NULL AND status IN ('ready_for_payment','awaiting_payment')")
    .bind(now, now, notice.transaction_nsu, notice.invoice_slug || notice.slug, order.id).run();
  if (updated.meta.changes && origin) scheduleOrderNotice(order.id, "paid", origin);
  return true;
}

export async function createCheckout(order: Order, origin: string) {
  const handle = paymentHandle();
  if (!handle) return { demo: true as const };
  const items: {quantity:number;price:number;description:string}[] = orderItems(order).map(item => ({
    quantity: item.quantity, price: item.price, description: item.name,
  }));
  if (order.delivery_fee && order.delivery_fee > 0) items.push({ quantity:1, price:order.delivery_fee, description:"Taxa de entrega" });
  const phone = order.phone.replace(/\D/g, "");
  const phoneNumber = phone.startsWith("55") ? `+${phone}` : `+55${phone}`;
  const response = await fetch("https://api.checkout.infinitepay.io/links", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      handle, order_nsu:order.id, items,
      redirect_url:`${origin}/pedido/${order.id}`,
      webhook_url:`${origin}/api/webhook/infinitepay`,
      customer:{name:order.name, email:order.email ?? undefined, phone_number:phoneNumber},
    }),
  });
  const result = await response.json() as {url?:string};
  if (!response.ok || !result.url || !result.url.startsWith("https://")) throw new Error("Não foi possível gerar o link Pix. Tente novamente.");
  await db().prepare("UPDATE orders SET checkout_url = ?, payment_mode = 'infinitepay', status = 'awaiting_payment', updated_at = ? WHERE id = ?")
    .bind(result.url, new Date().toISOString(), order.id).run();
  scheduleOrderNotice(order.id, "pix_available", origin);
  return { demo:false as const, url:result.url };
}
