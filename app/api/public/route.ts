import { config, json, menu, paidCount, paymentHandle } from "@/lib/store";

export async function GET() {
  const [settings, paid] = await Promise.all([config(), paidCount()]);
  return json({ menu, ...settings, paid, demo: !paymentHandle() });
}
