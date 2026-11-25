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

/** `spaced` (cron only) waits between WhatsApp messages to avoid looking like a bulk sender. */
export async function retryOrderNotifications({ spaced = false } = {}) {
  await Promise.all([
    retryEvolutionNotifications({ spaced }).catch(error => console.error("Falha ao repetir avisos Evolution", error)),
    retryEmailNotifications().catch(error => console.error("Falha ao repetir avisos por e-mail", error)),
  ]);
}
