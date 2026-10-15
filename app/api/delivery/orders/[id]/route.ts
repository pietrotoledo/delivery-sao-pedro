import { orderItemLabels } from "@/lib/order-item-labels";
import { deliveryOnly } from "@/lib/delivery-auth";
import { getOrder, json, orderItems } from "@/lib/store";

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  if (!await deliveryOnly(request)) return json({error: "Acesso restrito aos entregadores."}, 403);
  const {id} = await context.params;
  const order = await getOrder(id);
  if (!order || order.method !== "delivery" || !order.paid_at || order.contact_deleted_at || !["paid", "preparing", "ready", "out_for_delivery", "completed"].includes(order.status)) {
    return json({error: "Pedido de entrega não encontrado."}, 404);
  }
  return json({order: {
    id: order.id, createdAt: order.created_at, name: order.name, phone: order.phone,
    neighborhood: order.neighborhood, address: order.address, notes: order.notes,
    items: orderItems(order).flatMap(item => item.unitRemovals?.length || item.unitDrinks?.length ? orderItemLabels(item).map(name => ({name, quantity: 1})) : [{name: item.name, quantity: item.quantity}]),
    status: order.status, confirmedAt: order.handoff_confirmed_at,
  }});
}
