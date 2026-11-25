"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CalendarDays, CalendarPlus, Check, ChevronDown, Pencil, Play, Search, Trash2 } from "lucide-react";
import { eventDayOf } from "@/lib/event-schedule";

export type SalesDay = { day: string; orders: number; revenue?: number; burgers?: number; capacity?: number | null };
type Props = {
  days: SalesDay[];
  currentDay: string;
  viewingDay: string;
  defaultCapacity: number;
  onView: (day: string) => void;
  onStart: (day: string, capacity: number) => Promise<void>;
  onAdd: (day: string, capacity: number, startNow: boolean) => Promise<void>;
  onRemove: (day: string) => Promise<void>;
  onEdit: (from: string, day: string, capacity: number) => Promise<void>;
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const label = (day: string, options: Intl.DateTimeFormatOptions) => {
  const text = new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...options });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** Distância em dias entre dois AAAA-MM-DD, contada pelo calendário e não pelas horas. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const countdown = (day: string, today: string) => {
  const diff = daysBetween(today, day);
  return diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff === -1 ? "ontem" : diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`;
};
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Seletor de dia de vendas no estilo dos painéis de loja: um botão com o dia e uma lista rolável que cresce sem ocupar a tela. */
export default function AdminDays({ days, currentDay, viewingDay, defaultCapacity, onView, onStart, onAdd, onRemove, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SalesDay | null>(null);
  const today = eventDayOf(new Date());
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [startNow, setStartNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!day) return;
    await run(async () => {
      if (editing) await onEdit(editing.day, day, capacity); else await onAdd(day, capacity, startNow);
      closeForm(); setOpen(false);
    });
  }

  function openForm(item?: SalesDay) {
    setEditing(item ?? null);
    setDay(item?.day ?? "");
    setCapacity(item?.capacity ?? defaultCapacity);
    setStartNow(true);
    setAdding(true);
  }

  function closeForm() { setAdding(false); setEditing(null); setDay(""); }

  function toggle() {
    setOpen(value => !value);
    closeForm();
    setQuery("");
    setCapacity(defaultCapacity);
  }

  const stateOf = (item: SalesDay) => item.day === currentDay ? "current" : item.day > currentDay ? "scheduled" : "past";
  const search = normalize(query.trim());
  const visible = days.filter(item => !search || normalize(`${label(item.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${item.day.split("-").reverse().join("/")}`).includes(search));
  const groups = [
    { key: "current", title: "Vendendo agora", items: visible.filter(item => stateOf(item) === "current") },
    { key: "scheduled", title: "Agendados", items: visible.filter(item => stateOf(item) === "scheduled") },
    { key: "past", title: "Encerrados", items: visible.filter(item => stateOf(item) === "past").reverse() },
  ].filter(group => group.items.length);
  const viewing = days.find(item => item.day === viewingDay);
  const viewingState = viewing ? stateOf(viewing) : "current";
  const ahead = (value: string) => { const diff = daysBetween(today, value); return diff <= 0 ? "É hoje." : diff === 1 ? "É amanhã." : `Faltam ${diff} dias.`; };
  const pastDay = Boolean(day) && day < today && day !== editing?.day;
  const dateLocked = Boolean(editing && editing.orders > 0);

  return <div className="day-picker" ref={root}>
    <button type="button" className="day-picker-button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
      <CalendarDays size={16} aria-hidden="true" />
      <span>{label(viewingDay, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")}</span>
      <em className={`day-chip is-${viewingState}`}>{viewingState === "current" ? "Vendendo" : viewingState === "scheduled" ? "Agendado" : "Encerrado"}</em>
      <small className="day-picker-count">{countdown(viewingDay, today)}</small>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className="day-picker-pop" role="dialog" aria-label="Escolher dia de vendas">
      {!adding && <>
        {days.length > 5 && <label className="day-picker-search"><Search size={15} aria-hidden="true" /><input type="search" autoFocus placeholder="Buscar dia (ex.: outubro, 30/10)" value={query} onChange={event => setQuery(event.target.value)} /></label>}
        <div className="day-picker-list">
          {groups.length === 0 && <p className="day-picker-empty">Nenhum dia encontrado.</p>}
          {groups.map(group => <section key={group.key}>
            <h3>{group.title} <span>{group.items.length}</span></h3>
            {group.items.map(item => {
              const name = label(item.day, { day: "numeric", month: "long" });
              const canEdit = item.day === currentDay || group.key === "scheduled";
              const canRemove = item.orders === 0 && item.day !== currentDay;
              const canStart = group.key === "scheduled" && item.day >= today;
              const facts = item.orders > 0
                ? `${item.orders} ${item.orders === 1 ? "pedido" : "pedidos"}${item.burgers ? ` · ${item.burgers} hambúrgueres` : ""}`
                : `Limite de ${item.capacity ?? defaultCapacity} hambúrgueres`;
              return <div key={item.day} className={`day-row${item.day === viewingDay ? " is-selected" : ""}`}>
                <button type="button" className="day-row-open" onClick={() => { onView(item.day); setOpen(false); }}>
                  <span className="day-row-date"><b>{label(item.day, { day: "2-digit" })}</b><small>{label(item.day, { month: "short" }).replace(".", "")}</small></span>
                  <span className="day-row-text">
                    <strong>{label(item.day, { weekday: "long", day: "numeric", month: "long" })}</strong>
                    <small>{facts}</small>
                  </span>
                  <span className="day-row-side">
                    {item.orders > 0 && <span className="day-row-money">{money(item.revenue ?? 0)}</span>}
                    <span className={`day-row-count${item.day >= today ? " is-ahead" : ""}`}>{countdown(item.day, today)}</span>
                  </span>
                  {item.day === viewingDay && <Check size={16} className="day-row-check" aria-label="Dia aberto" />}
                </button>
                {(canStart || canEdit || canRemove) && <span className="day-row-actions">
                  {canStart && <button type="button" className="is-start" disabled={busy} onClick={() => run(async () => { await onStart(item.day, item.capacity ?? defaultCapacity); setOpen(false); })}><Play size={12} aria-hidden="true" /> Vender</button>}
                  {canEdit && <button type="button" className="is-icon" disabled={busy} onClick={() => openForm(item)} aria-label={`Editar ${name}`} title="Editar data ou limite"><Pencil size={14} aria-hidden="true" /></button>}
                  {canRemove && <button type="button" className="is-icon is-remove" disabled={busy} onClick={() => run(() => onRemove(item.day))} aria-label={`Apagar ${name}`} title="Apagar dia"><Trash2 size={14} aria-hidden="true" /></button>}
                </span>}
              </div>;
            })}
          </section>)}
        </div>
        <button type="button" className="day-picker-add" onClick={() => openForm()}><CalendarPlus size={16} aria-hidden="true" /> Adicionar dia de vendas</button>
      </>}
      {adding && <form className="day-picker-form" onSubmit={submit}>
        <div className="day-picker-form-head"><Image src="/pablo/pablo-acenando.webp" width={503} height={700} sizes="48px" alt="" /><div>
          <strong>{editing ? `Editar ${label(editing.day, { day: "numeric", month: "long" })}` : "Nova noite de vendas"}</strong>
          <small>{editing ? editing.day === currentDay ? "É o dia que está vendendo agora. A loja passa a mostrar a nova data." : "O dia continua agendado com os novos dados." : "Os pedidos dos outros dias ficam guardados."}</small>
        </div></div>
        <label>Data<input type="date" required autoFocus={!dateLocked} min={editing?.day && editing.day < today ? editing.day : today} disabled={dateLocked} value={day} onChange={event => setDay(event.target.value)} aria-invalid={pastDay} aria-describedby="day-form-hint" /></label>
        <label>Limite de hambúrgueres<input type="number" min="1" max="10000" required autoFocus={dateLocked} value={capacity} onChange={event => setCapacity(Number(event.target.value))} /></label>
        {!editing && <fieldset>
          <legend>Quando começar</legend>
          <label className="day-choice"><input type="radio" name="start" checked={startNow} onChange={() => setStartNow(true)} /> Vender nesse dia a partir de agora</label>
          <label className="day-choice"><input type="radio" name="start" checked={!startNow} onChange={() => setStartNow(false)} /> Só agendar, começo depois</label>
        </fieldset>}
        <p id="day-form-hint" className={pastDay ? "is-error" : ""}>{pastDay
          ? "Essa data já passou. Dá para vender só hoje ou num dia futuro."
          : dateLocked ? "Esse dia já tem pedidos, então a data fica. Dá para mudar o limite."
          : day ? `${ahead(day)} ${editing ? "" : startNow ? "O site passa a mostrar essa data e o contador recomeça do zero." : "Quando chegar a hora, use \"Vender\"."}`
          : "Escolha hoje ou uma data futura."}</p>
        <div className="day-picker-form-actions"><button type="button" className="mini-button secondary" onClick={closeForm}>Voltar</button><button type="submit" className="mini-button" disabled={busy || !day || pastDay}>{busy ? "Salvando..." : editing ? "Salvar alterações" : startNow ? "Adicionar e abrir vendas" : "Agendar dia"}</button></div>
      </form>}
    </div>}
  </div>;
}
