import { eventLocation } from "./event-location";

export type EventReminder = "event_morning" | "event_evening";

// Primeira noite do evento. Os outros dias são abertos pelo painel e ficam gravados em cada pedido (event_day).
// Mantenha igual a defaultEventDay em stock-rules.ts.
export const firstEventDay = "2026-12-03";
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const safeDay = (day?: string | null) => day && dayPattern.test(day) ? day : firstEventDay;

const noon = (day: string) => new Date(`${day}T12:00:00-03:00`);
const format = (day: string, options: Intl.DateTimeFormatOptions) => noon(day).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...options });

/** Textos de data de um dia de vendas: "3 de dezembro de 2026", "3 de dezembro", "03/12", "quinta-feira". */
export function eventDayText(day?: string | null) {
  const value = safeDay(day);
  const short = format(value, { day: "numeric", month: "long" });
  const numeric = `${value.slice(8, 10)}/${value.slice(5, 7)}`;
  return { day: value, full: `${short} de ${value.slice(0, 4)}`, short, numeric, weekday: format(value, { weekday: "long" }) };
}

export function eventScheduleFor(day?: string | null) {
  const { full } = eventDayText(day);
  return {
    date: full,
    delivery: `Delivery a partir das 19h, em ${full} (horário de João Pessoa).`,
    pickup: `Retirada em ${full}, das 18h às 22h, no ${eventLocation.name}, ${eventLocation.address}.`,
  };
}

export const eventSchedule = {
  ...eventScheduleFor(firstEventDay),
  origin: "https://delivery-sao-pedro.pietroct21.workers.dev",
} as const;

/** Dia (AAAA-MM-DD) de um instante no horário de João Pessoa. */
export function eventDayOf(now: Date) {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

// Um único lembrete no dia, para poupar o número da loja. A janela longa dá tempo de enviar com intervalo entre
// as mensagens sem disputar com os avisos de pronto/saiu para entrega da noite.
function remindersFor(day: string) {
  return [{ event: "event_morning" as const, start: `${day}T11:00:00-03:00`, end: `${day}T14:00:00-03:00` }];
}

export function dueEventReminder(now: Date, day?: string | null) {
  return remindersFor(safeDay(day)).find(reminder => now.getTime() >= Date.parse(reminder.start) && now.getTime() < Date.parse(reminder.end)) ?? null;
}

export function isEventReminder(event: string): event is EventReminder {
  return event === "event_morning" || event === "event_evening";
}

export function eventReminderActive(event: EventReminder, now = new Date(), day?: string | null) {
  return dueEventReminder(now, day)?.event === event;
}

export function orderEventSchedule(method: "delivery" | "pickup", day?: string | null) {
  const schedule = eventScheduleFor(day);
  return method === "delivery" ? schedule.delivery : schedule.pickup;
}

export function eventReminderText(method: "delivery" | "pickup", event: EventReminder, day?: string | null) {
  const { short, weekday } = eventDayText(day);
  const when = `nesta ${weekday}, ${short}`;
  const intro = event === "event_morning"
    ? `É hoje! A Noite do Hambúrguer BLUECKYARDIGANS acontece ${when}.`
    : `É hoje, e está chegando a hora! A Noite do Hambúrguer BLUECKYARDIGANS acontece ${when}.`;
  const schedule = method === "delivery"
    ? "As entregas começam às 19h. Esse é o início do delivery; acompanhe a saída do seu pedido pelo link abaixo."
    : `Sua retirada será das 18h às 22h, no ${eventLocation.name}, ${eventLocation.address}.`;
  return `${intro}\n\n${schedule}\n\nObrigado por fazer parte dessa noite!`;
}
