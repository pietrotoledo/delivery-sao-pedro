"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import BrandAvatar from "@/components/brand-avatar";

type Item = {id: string; name: string; quantity: number; price: number; removedIngredients?: string[]};
type TeamOrder = {
  id: string; createdAt: string; name: string; method: "delivery" | "pickup";
  neighborhood: string | null; address: string | null; notes: string | null;
  items: Item[]; subtotal: number; deliveryFee: number | null; total: number | null;
  status: string; paidAt: string | null; confirmedAt: string | null; canConfirm: boolean;
};
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
const date = (value: string) => new Date(value).toLocaleString("pt-BR", {timeZone: "America/Sao_Paulo"});
const statusLabels: Record<string, string> = {
  awaiting_quote: "Aguardando taxa", ready_for_payment: "Aguardando pagamento", awaiting_payment: "Aguardando pagamento",
  paid: "Pago", preparing: "Em preparo", ready: "Pronto para retirada",
  out_for_delivery: "Saiu para entrega", completed: "Concluído", refunded: "Devolução registrada",
};

export default function TeamOrderPage() {
  const id = String(useParams().id);
  const [token, setToken] = useState("");
  const [order, setOrder] = useState<TeamOrder | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const printed = useRef(false);

  useEffect(() => {
    const sharedToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(sharedToken);
    if (!sharedToken) { setLoading(false); setError("Link da equipe inválido. Abra o pedido pelo painel admin."); }
  }, []);
  const load = useCallback(async () => {
    if (!token) { setLoading(false); setError("Link da equipe inválido. Abra o pedido pelo painel admin."); return; }
    try {
      const response = await fetch(`/api/team/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {cache: "no-store"});
      const result = await response.json() as {order?: TeamOrder; error?: string};
      if (!response.ok || !result.order) throw new Error(result.error || "Não foi possível carregar o pedido.");
      setOrder(result.order);
      setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar o pedido."); }
    finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    const initial = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => { void load(); }, 10000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load, token]);

  useEffect(() => {
    if (!order || printed.current || new URLSearchParams(window.location.search).get("print") !== "1") return;
    printed.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("print");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [order]);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) { setError("Digite os quatro últimos dígitos do telefone."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/team/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({code}),
      });
      const result = await response.json() as {order?: TeamOrder; error?: string};
      if (!response.ok || !result.order) throw new Error(result.error || "Não foi possível confirmar.");
      setOrder(result.order);
      setCode("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar."); }
    finally { setBusy(false); }
  }

  const mapUrl = order?.method === "delivery" && order.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([order.address, order.neighborhood, "João Pessoa, PB"].filter(Boolean).join(", "))}`
    : null;
  const pickup = order?.method === "pickup";

  return <div className="team-page">
    <header className="team-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><span>Equipe de entrega e retirada</span></header>
    <main className="team-wrap">
      <div className="team-intro"><p className="section-kicker">Pedido #{id.slice(0, 8).toUpperCase()}</p><h1>{order ? (pickup ? "Confirmação de retirada" : "Entrega do pedido") : "Pedido da equipe"}</h1><p>Confira os itens e confirme o recebimento com o código informado pelo cliente.</p></div>
      {loading && <div className="team-card">Carregando pedido...</div>}
      {error && <div className="team-error" role="alert">{error}</div>}
      {order && <>
        <section className="team-card team-order-card">
          <div className="team-card-head"><div><small>PEDIDO</small><h2>#{order.id.slice(0, 8).toUpperCase()}</h2></div><span className="team-status">{statusLabels[order.status] ?? order.status}</span></div>
          <div className="team-fact"><span>Cliente</span><strong>{order.name}</strong></div>
          <div className="team-fact"><span>Recebimento</span><strong>{pickup ? "Retirada presencial" : "Delivery"}</strong></div>
          {order.method === "delivery" && <div className="team-address"><span>Endereço de entrega</span><strong>{order.address || "Endereço não informado"}{order.neighborhood ? ` · ${order.neighborhood}` : ""}</strong>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">Abrir rota no Google Maps ↗</a>}</div>}
          <div className="team-items"><h3>Itens</h3>{order.items.map((item, index) => <div className="team-item" key={`${item.id}-${index}`}><strong>{item.quantity}× {item.name}</strong><span>{money(item.quantity * item.price)}</span>{item.removedIngredients?.length ? <small>Sem: {item.removedIngredients.join(", ")}</small> : null}</div>)}</div>
          {order.notes && <div className="team-notes"><strong>Observação</strong><p>{order.notes}</p></div>}
          <div className="team-fact"><span>Produtos</span><strong>{money(order.subtotal)}</strong></div>
          {order.method === "delivery" && <div className="team-fact"><span>Entrega</span><strong>{order.deliveryFee === null ? "A definir" : money(order.deliveryFee)}</strong></div>}
          <div className="team-fact team-total"><span>Total</span><strong>{order.total === null ? "A definir" : money(order.total)}</strong></div>
          <p className="team-created">Criado em {date(order.createdAt)}</p>
          <div className="team-print"><button type="button" onClick={() => window.print()}>Imprimir nota do pedido</button></div>
        </section>
        <section className="team-card team-confirm">
          <small>CONFIRMAÇÃO</small><h2>{pickup ? "Confirmar retirada" : "Confirmar entrega"}</h2>
          {order.status === "completed" ? <div className="team-success" role="status">✓ Pedido {pickup ? "retirado" : "entregue"} e finalizado{order.confirmedAt ? ` em ${date(order.confirmedAt)}` : ""}.</div>
            : order.canConfirm ? <><p>Peça ao cliente os quatro últimos dígitos do telefone informado na compra. O código não aparece nesta tela.</p><form onSubmit={confirm}><label htmlFor="handoff-code">Código de confirmação</label><input id="handoff-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} placeholder="0000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required /><button type="submit" disabled={busy || code.length !== 4}>{busy ? "Confirmando..." : pickup ? "Confirmar retirada" : "Confirmar entrega"}</button></form></>
            : <p>Este pedido ainda não pode ser finalizado. Aguarde o pagamento e a atualização para “{pickup ? "Pronto para retirada" : "Saiu para entrega"}” no painel.</p>}
        </section>
      </>}
    </main>
  </div>;
}
