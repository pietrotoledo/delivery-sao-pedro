import Checkout from "@/components/checkout";
import EventPause from "@/components/event-pause";
import { eventSalesPaused } from "@/lib/event-announcement";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  if (eventSalesPaused) return <EventPause />;
  const { items = "" } = await searchParams;
  return <Checkout initialItems={items} />;
}
