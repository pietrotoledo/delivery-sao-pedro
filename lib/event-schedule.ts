import { eventLocation } from "./event-location";

export type EventReminder = "event_morning" | "event_evening";

export const eventSchedule = {
  date: "30 de outubro de 2026",
  delivery: "Delivery a partir das 19h, em 30 de outubro de 2026 (horário de João Pessoa).",
  pickup: `Retirada em 30 de outubro de 2026, das 18h às 22h, no ${eventLocation.name}, ${eventLocation.address}.`,
  origin: "https://delivery-sao-pedro.pietroct21.workers.dev",
} as const;

const reminders = [
  { event: "event_morning", start: "2026-10-30T11:00:00-03:00", end: "2026-10-30T12:00:00-03:00" },
  { event: "event_evening", start: "2026-10-30T18:00:00-03:00", end: "2026-10-30T19:00:00-03:00" },
] as const;

export function dueEventReminder(now: Date) {
  return reminders.find(reminder => now.getTime() >= Date.parse(reminder.start) && now.getTime() < Date.parse(reminder.end)) ?? null;
}

export function isEventReminder(event: string): event is EventReminder {
  return event === "event_morning" || event === "event_evening";
}

export function eventReminderActive(event: EventReminder, now = new Date()) {
  return dueEventReminder(now)?.event === event;
}

export function orderEventSchedule(method: "delivery" | "pickup") {
  return method === "delivery" ? eventSchedule.delivery : eventSchedule.pickup;
}

export function eventReminderText(method: "delivery" | "pickup", event: EventReminder) {
  const intro = event === "event_morning"
    ? "É hoje! A Noite do Hambúrguer BLUECKYARDIGANS acontece nesta sexta-feira, 30 de outubro."
    : "É hoje, e está chegando a hora! A Noite do Hambúrguer BLUECKYARDIGANS acontece nesta sexta-feira, 30 de outubro.";
  const schedule = method === "delivery"
    ? "As entregas começam às 19h. Esse é o início do delivery; acompanhe a saída do seu pedido pelo link abaixo."
    : `Sua retirada será das 18h às 22h, no ${eventLocation.name}, ${eventLocation.address}.`;
  return `${intro}\n\n${schedule}\n\nObrigado por fazer parte dessa noite!`;
}
