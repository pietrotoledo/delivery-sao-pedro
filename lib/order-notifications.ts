import { scheduleOrderNotice, scheduleNotificationRetries, retryEvolutionNotifications, type OrderNotice } from "./evolution-notifications";
import { scheduleOrderEmail, scheduleEmailRetries, retryEmailNotifications } from "./email-notifications";

export type { OrderNotice };

export function scheduleOrderNotifications(orderId: string, event: OrderNotice, origin: string) {
  scheduleOrderNotice(orderId, event, origin);
  scheduleOrderEmail(orderId, event, origin);
}

export function scheduleOrderNotificationRetries() {
  scheduleNotificationRetries();
  scheduleEmailRetries();
}

export async function retryOrderNotifications() {
  await Promise.all([
    retryEvolutionNotifications().catch(error => console.error("Falha ao repetir avisos Evolution", error)),
    retryEmailNotifications().catch(error => console.error("Falha ao repetir avisos por e-mail", error)),
  ]);
}
