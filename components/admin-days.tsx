"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarPlus, Play, Plus, Trash2, X } from "lucide-react";

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
const part = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...options }).replace(".", "");

/** Linha do tempo das noites de venda: as que passaram, a atual e as agendadas, com o botão para adicionar mais. */
export default function AdminDays({ days, currentDay, viewingDay, defaultCapacity, onView, onStart, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState("");
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [startNow, setStartNow] = useState(true);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!day) return;
    await run(async () => { await onAdd(day, capacity, startNow); setAdding(false); setDay(""); });
  }

  function openForm() {
    setCapacity(defaultCapacity);
    setAdding(open => !open);
  }

  const totalRevenue = days.reduce((sum, item) => sum + (item.revenue ?? 0), 0);
  const nights = days.filter(item => (item.orders ?? 0) > 0).length;

  return <section className="sales-trail" aria-label="Dias de venda">
    <div className="sales-trail-head">
      <div>
        <p className="section-kicker">Trajetória</p>
        <h2>Noites de venda</h2>
        <p>Toque num dia para ver os pedidos e o relatório. Para vender de novo, adicione um dia no fim da trilha.</p>
      </div>
      {nights > 1 && <dl className="sales-trail-total"><dt>Todas as noites</dt><dd>{money(totalRevenue)}</dd><small>{nights} noites com vendas</small></dl>}
    </div>
    <ol className="sales-trail-track">
      {days.map(item => {
        const current = item.day === currentDay;
        const scheduled = !current && item.orders === 0 && item.day > currentDay;
        const state = current ? "current" : scheduled ? "scheduled" : "past";
        const viewing = item.day === viewingDay;
        return <li key={item.day} className={`trail-stop is-${state}${viewing ? " is-viewing" : ""}`}>
          {current && <Image className="trail-pablo" src="/pablo/pablo-andando.webp" width={277} height={350} sizes="56px" alt="" />}
          <span className="trail-dot" aria-hidden="true" />
          <div className="trail-card">
            <button type="button" className="trail-open" onClick={() => onView(item.day)} aria-pressed={viewing}>
              <span className="trail-weekday">{part(item.day, { weekday: "short" })}</span>
              <span className="trail-date"><b>{part(item.day, { day: "numeric" })}</b> {part(item.day, { month: "short" })}</span>
              <span className="trail-state">{current ? "Vendendo agora" : scheduled ? "Agendado" : "Encerrado"}</span>
              <span className="trail-facts">{scheduled ? `Limite ${item.capacity ?? defaultCapacity}` : `${item.orders} ${item.orders === 1 ? "pedido" : "pedidos"}${item.revenue ? ` · ${money(item.revenue)}` : ""}`}</span>
            </button>
            {scheduled && <div className="trail-actions">
              <button type="button" disabled={busy} onClick={() => run(() => onStart(item.day, item.capacity ?? defaultCapacity))}><Play size={13} aria-hidden="true" /> Vender neste dia</button>
              <button type="button" className="trail-remove" disabled={busy} onClick={() => run(() => onRemove(item.day))} aria-label={`Remover ${part(item.day, { day: "numeric", month: "long" })}`} title="Remover dia"><Trash2 size={14} aria-hidden="true" /></button>
            </div>}
          </div>
        </li>;
      })}
      <li className="trail-stop is-add">
        <span className="trail-dot" aria-hidden="true"><Plus size={14} /></span>
        <button type="button" className="trail-card trail-add" onClick={openForm} aria-expanded={adding} aria-controls="novo-dia">
          {adding ? <X size={22} aria-hidden="true" /> : <CalendarPlus size={22} aria-hidden="true" />}
          <span>{adding ? "Cancelar" : "Adicionar dia"}</span>
        </button>
      </li>
    </ol>
    {adding && <form id="novo-dia" className="trail-form" onSubmit={submit}>
      <Image className="trail-form-pablo" src="/pablo/pablo-acenando.webp" width={503} height={700} sizes="90px" alt="" />
      <div className="trail-form-fields">
        <label>Data da noite<input type="date" required value={day} onChange={event => setDay(event.target.value)} /></label>
        <label>Limite de hambúrgueres<input type="number" min="1" max="10000" required value={capacity} onChange={event => setCapacity(Number(event.target.value))} /></label>
        <fieldset>
          <legend>Quando começar</legend>
          <label className="trail-choice"><input type="radio" name="start" checked={startNow} onChange={() => setStartNow(true)} /> Vender nesse dia a partir de agora</label>
          <label className="trail-choice"><input type="radio" name="start" checked={!startNow} onChange={() => setStartNow(false)} /> Só agendar, começo depois</label>
        </fieldset>
        <button type="submit" className="mini-button" disabled={busy || !day}>{busy ? "Salvando..." : startNow ? "Adicionar e abrir vendas" : "Adicionar à trilha"}</button>
      </div>
      <p>{startNow ? "O site passa a mostrar essa data, o contador recomeça do zero e os pedidos dos outros dias ficam guardados para o relatório." : "O dia entra na trilha como agendado. Quando chegar a hora, use \"Vender neste dia\"."}</p>
    </form>}
  </section>;
}
