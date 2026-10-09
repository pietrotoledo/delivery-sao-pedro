import { config, getProducts, json, paidCount, paymentHandle } from "@/lib/store";
import { evolutionEnabled } from "@/lib/evolution-notifications";
import { emailEnabled } from "@/lib/email-notifications";

export async function GET() {
  const [settings, paid, menu] = await Promise.all([config(), paidCount(), getProducts()]);
  return json({ menu, ...settings, paid, demo: !paymentHandle(), whatsappNotifications: evolutionEnabled(), emailNotifications: emailEnabled() });
}
