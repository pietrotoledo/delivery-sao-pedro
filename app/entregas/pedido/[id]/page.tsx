import DeliveryOrderDetail from "@/components/delivery-order-detail";

export default async function DeliveryOrderPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <DeliveryOrderDetail id={id} />;
}
