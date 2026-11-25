"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CalendarDays, CalendarPlus, Check, ChevronDown, Play, Search, Trash2 } from "lucide-react";

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
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const label = (day: string, options: Intl.DateTimeFormatOptions) => {
  const text = new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...options });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Seletor de dia de vendas no estilo dos painéis de loja: um botão com o dia e uma lista rolável que cresce sem ocupar a tela. */
export default function AdminDays({ days, currentDay, viewingDay, defaultCapacity, onView, onStart, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
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
    await run(async () => { await onAdd(day, capacity, startNow); setAdding(false); setDay(""); setOpen(false); });
  }

  function toggle() {
    setOpen(value => !value);
    setAdding(false);
    setQuery("");
    setCapacity(defaultCapacity);
  }

  const stateOf = (item: SalesDay) => item.day === currentDay ? "current" : item.orders === 0 && item.day > currentDay ? "scheduled" : "past";
  const search = normalize(query.trim());
  const visible = days.filter(item => !search || normalize(`${label(item.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${item.day.split("-").reverse().join("/")}`).includes(search));
  const groups = [
    { key: "current", title: "Vendendo agora", items: visible.filter(item => stateOf(item) === "current") },
    { key: "scheduled", title: "Agendados", items: visible.filter(item => stateOf(item) === "scheduled") },
    { key: "past", title: "Encerrados", items: visible.filter(item => stateOf(item) === "past").reverse() },
  ].filter(group => group.items.length);
  const viewing = days.find(item => item.day === viewingDay);
  const viewingState = viewing ? stateOf(viewing) : "current";

  return <div className="day-picker" ref={root}>
    <button type="button" className="day-picker-button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
      <CalendarDays size={17} aria-hidden="true" />
      <span>{label(viewingDay, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "")}</span>
      <em className={`day-chip is-${viewingState}`}>{viewingState === "current" ? "Vendendo agora" : viewingState === "scheduled" ? "Agendado" : "Encerrado"}</em>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="day-picker-pop" role="dialog" aria-label="Escolher dia de vendas">
      {!adding && <>
        {days.length > 5 && <label className="day-picker-search"><Search size={15} aria-hidden="true" /><input type="search" autoFocus placeholder="Buscar dia (ex.: outubro, 30/10)" value={query} onChange={event => setQuery(event.target.value)} /></label>}
        <div className="day-picker-list">
          {groups.length === 0 && <p className="day-picker-empty">Nenhum dia encontrado.</p>}
          {groups.map(group => <section key={group.key}>
            <h3>{group.title} <span>{group.items.length}</span></h3>
            {group.items.map(item => <div key={item.day} className={`day-row${item.day === viewingDay ? " is-selected" : ""}`}>
              <button type="button" className="day-row-open" onClick={() => { onView(item.day); setOpen(false); }}>
                <span className="day-row-date"><b>{label(item.day, { day: "2-digit" })}</b><small>{label(item.day, { month: "short" }).replace(".", "")}</small></span>
                <span className="day-row-text">
                  <strong>{label(item.day, { weekday: "long", day: "numeric", month: "long" })}</strong>
                  <small>{group.key === "scheduled" ? `Limite de ${item.capacity ?? defaultCapacity} hambúrgueres` : `${item.orders} ${item.orders === 1 ? "pedido" : "pedidos"}${item.burgers ? ` · ${item.burgers} hambúrgueres` : ""}`}</small>
                </span>
                {group.key !== "scheduled" && <span className="day-row-money">{money(item.revenue ?? 0)}</span>}
                {item.day === viewingDay && <Check size={16} className="day-row-check" aria-label="Dia aberto" />}
              </button>
              {group.key === "scheduled" && <span className="day-row-actions">
                <button type="button" disabled={busy} onClick={() => run(async () => { await onStart(item.day, item.capacity ?? defaultCapacity); setOpen(false); })}><Play size={12} aria-hidden="true" /> Vender</button>
                <button type="button" className="is-remove" disabled={busy} onClick={() => run(() => onRemove(item.day))} aria-label={`Remover ${label(item.day, { day: "numeric", month: "long" })}`} title="Remover dia"><Trash2 size={14} aria-hidden="true" /></button>
              </span>}
            </div>)}
          </section>)}
        </div>
        <button type="button" className="day-picker-add" onClick={() => setAdding(true)}><CalendarPlus size={16} aria-hidden="true" /> Adicionar dia de vendas</button>
      </>}
      {adding && <form className="day-picker-form" onSubmit={submit}>
        <div className="day-picker-form-head"><Image src="/pablo/pablo-acenando.webp" width={503} height={700} sizes="48px" alt="" /><div><strong>Nova noite de vendas</strong><small>Os pedidos dos outros dias ficam guardados.</small></div></div>
        <label>Data<input type="date" required autoFocus value={day} onChange={event => setDay(event.target.value)} /></label>
        <label>Limite de hambúrgueres<input type="number" min="1" max="10000" required value={capacity} onChange={event => setCapacity(Number(event.target.value))} /></label>
        <fieldset>
          <legend>Quando começar</legend>
          <label className="day-choice"><input type="radio" name="start" checked={startNow} onChange={() => setStartNow(true)} /> Vender nesse dia a partir de agora</label>
          <label className="day-choice"><input type="radio" name="start" checked={!startNow} onChange={() => setStartNow(false)} /> Só agendar, começo depois</label>
        </fieldset>
        <p>{startNow ? "O site passa a mostrar essa data e o contador recomeça do zero." : "O dia fica na lista como agendado. Quando chegar a hora, use \"Vender\"."}</p>
        <div className="day-picker-form-actions"><button type="button" className="mini-button secondary" onClick={() => setAdding(false)}>Voltar</button><button type="submit" className="mini-button" disabled={busy || !day}>{busy ? "Salvando..." : startNow ? "Adicionar e abrir vendas" : "Agendar dia"}</button></div>
      </form>}
    </div>}
  </div>;
}
