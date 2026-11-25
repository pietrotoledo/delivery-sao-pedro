"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, MessageCircle, ShoppingBag, Truck } from "lucide-react";

export type KanbanOrder = {
  id: string; created_at: string; name: string; phone: string; method: string;
  neighborhood: string | null; items_json: string; burger_count: number;
  total: number | null; status: string; paid_at: string | null; delivery_driver_name?: string | null;
};

type Column = { id: string; title: string; hint: string; accepts: boolean };

// Etapas do pedido na ordem em que a cozinha trabalha. "Aguardando" e "Fora da fila" só mostram;
// pedidos sem pagamento não andam pelo quadro.
const columns: Column[] = [
  { id: "waiting", title: "Aguardando pagamento", hint: "Pix ou taxa pendente", accepts: false },
  { id: "paid", title: "Pago", hint: "Na fila da cozinha", accepts: true },
  { id: "preparing", title: "Em preparo", hint: "Na chapa", accepts: true },
  { id: "ready", title: "Pronto", hint: "Embalado", accepts: true },
  { id: "out_for_delivery", title: "Saiu para entrega", hint: "Só delivery", accepts: true },
  { id: "completed", title: "Concluído", hint: "Entregue ou retirado", accepts: true },
  { id: "closed", title: "Fora da fila", hint: "Expirados e devolvidos", accepts: false },
];
const flow = ["paid", "preparing", "ready", "out_for_delivery", "completed"];

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function columnOf(order: KanbanOrder) {
  if (order.status === "refunded" || order.status === "expired") return "closed";
  if (!order.paid_at) return "waiting";
  return flow.includes(order.status) ? order.status : "paid";
}

function stepsFor(order: KanbanOrder) {
  return order.method === "delivery" ? flow : flow.filter(step => step !== "out_for_delivery");
}

// Diz se o pedido pode ir para a etapa; a regra espelha a da API.
export function moveProblem(order: KanbanOrder, target: string) {
  if (!order.paid_at || order.status === "refunded") return "Só pedidos pagos andam pelo quadro.";
  if (order.status === "completed") return "Pedido concluído não volta de etapa.";
  if (target === order.status) return "";
  if (target === "out_for_delivery" && order.method !== "delivery") return "Pedido de retirada não sai para entrega.";
  if (target === "completed") {
    const expected = order.method === "delivery" ? "out_for_delivery" : "ready";
    if (order.status !== expected) return order.method === "delivery" ? "Para concluir, o pedido precisa estar em “Saiu para entrega”." : "Para concluir, o pedido precisa estar “Pronto”.";
  }
  if (!flow.includes(target)) return "Esta coluna não recebe pedidos.";
  return "";
}

export default function AdminKanban({ orders, busyId, onMove, itemsLabel, whatsappHref }: {
  orders: KanbanOrder[];
  busyId: string | null;
  onMove: (order: KanbanOrder, status: string) => void;
  itemsLabel: (order: KanbanOrder) => string;
  whatsappHref: (phone: string) => string | null;
}) {
  const [dragging, setDragging] = useState<KanbanOrder | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function tryMove(order: KanbanOrder, target: string) {
    const problem = moveProblem(order, target);
    if (problem) { setMessage(problem); return; }
    if (target === order.status) return;
    setMessage("");
    onMove(order, target);
  }

  function step(order: KanbanOrder, direction: -1 | 1) {
    const steps = stepsFor(order);
    const target = steps[steps.indexOf(order.status) + direction];
    if (target) tryMove(order, target);
  }

  return <div className="kanban-wrap">
    <p className="kanban-help">Arraste o cartão para outra etapa. No celular, use as setas do cartão. O cliente recebe o aviso de cada etapa como antes.</p>
    {message && <p className="kanban-message" role="alert">{message}</p>}
    <div className="kanban" role="list" aria-label="Quadro de pedidos por etapa">
      {columns.map(column => {
        const cards = orders.filter(order => columnOf(order) === column.id).sort((a, b) => (a.paid_at || a.created_at).localeCompare(b.paid_at || b.created_at));
        const allowed = dragging ? !moveProblem(dragging, column.id) && column.accepts : false;
        return <section key={column.id} role="listitem" aria-label={`${column.title}: ${cards.length}`}
          className={`kanban-col col-${column.id}${dragging ? allowed ? " can-drop" : " no-drop" : ""}${over === column.id && allowed ? " is-over" : ""}`}
          onDragOver={event => { if (allowed) { event.preventDefault(); setOver(column.id); } }}
          onDragLeave={() => setOver(current => current === column.id ? null : current)}
          onDrop={event => { event.preventDefault(); setOver(null); if (dragging) tryMove(dragging, column.id); setDragging(null); }}>
          <header><h3>{column.title}</h3><span>{cards.length}</span><small>{column.hint}</small></header>
          <div className="kanban-cards">
            {cards.length === 0 && <p className="kanban-empty">Nenhum pedido</p>}
            {cards.map(order => {
              const movable = Boolean(order.paid_at) && !["refunded", "completed", "expired"].includes(order.status);
              const steps = stepsFor(order);
              const index = steps.indexOf(order.status);
              const whatsapp = whatsappHref(order.phone);
              return <article key={order.id} className={`kanban-card${movable ? " is-movable" : ""}${busyId === order.id ? " is-busy" : ""}${dragging?.id === order.id ? " is-dragging" : ""}`}
                draggable={movable && busyId !== order.id}
                onDragStart={event => { setDragging(order); setMessage(""); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", order.id); }}
                onDragEnd={() => { setDragging(null); setOver(null); }}>
                <div className="kanban-card-top">
                  {movable && <GripVertical size={14} aria-hidden="true" className="kanban-grip" />}
                  <strong>{order.name}</strong>
                  {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${order.name}`}><MessageCircle size={14} /></a>}
                </div>
                <p className="kanban-items">{itemsLabel(order)}</p>
                <div className="kanban-meta">
                  <span className={order.method === "pickup" ? "is-pickup" : "is-delivery"}>{order.method === "pickup" ? <ShoppingBag size={12} /> : <Truck size={12} />}{order.method === "pickup" ? "Retirada" : order.neighborhood || "Delivery"}</span>
                  <span>#{order.id.slice(0, 6).toUpperCase()} · {time(order.paid_at || order.created_at)}</span>
                </div>
                <div className="kanban-card-foot">
                  <b>{order.total === null ? "A definir" : money(order.total)}</b>
                  {order.delivery_driver_name && <small>{order.delivery_driver_name}</small>}
                  {movable && <span className="kanban-steps">
                    <button type="button" disabled={index <= 0 || busyId === order.id} onClick={() => step(order, -1)} aria-label={`Voltar ${order.name} uma etapa`}><ChevronLeft size={16} /></button>
                    <button type="button" disabled={index >= steps.length - 1 || busyId === order.id} onClick={() => step(order, 1)} aria-label={`Avançar ${order.name} uma etapa`}><ChevronRight size={16} /></button>
                  </span>}
                </div>
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
