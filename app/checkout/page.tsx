import Checkout from "@/components/checkout";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items = "" } = await searchParams;
  return <Checkout initialItems={items} />;
}
