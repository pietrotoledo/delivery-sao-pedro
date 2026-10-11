"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, KeyRound, MapPinned, Phone, RefreshCw, Truck } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import { deliveryDirectionsUrl, deliveryPhoneHref } from "@/lib/delivery-links";

type DeliveryOrder = {
  id: string; createdAt: string; name: string; phone: string;
  neighborhood: string | null; address: string | null; notes: string | null;
  items: { name: string; quantity: number }[]; status: string;
  confirmedAt: string | null;
};
type DeliveryData = { orders: DeliveryOrder[]; error?: string };

const statusLabels: Record<string, string> = {
  paid: "Pago", preparing: "Em preparo", ready: "Pronto para sair",
  out_for_delivery: "Saiu para entrega", completed: "Entregue",
};

function DeliveryConfirmation({ orderId, onConfirmed }: { orderId: string; onConfirmed: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) { setError("Digite os quatro dígitos do código."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/delivery/orders/${encodeURIComponent(orderId)}/confirm`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível confirmar a entrega.");
      setCode("");
      await onConfirmed();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar a entrega."); }
    finally { setBusy(false); }
  }

  return <div className="delivery-confirm">
    <div className="delivery-confirm-heading"><KeyRound size={19} /><div><strong>Código de verificação</strong><p>Peça ao cliente os quatro últimos dígitos do telefone informado no pedido.</p></div></div>
    <form onSubmit={confirm}><label className="sr-only" htmlFor={`delivery-code-${orderId}`}>Código de verificação do pedido</label><input id={`delivery-code-${orderId}`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} placeholder="0000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required /><button type="submit" disabled={busy || code.length !== 4}>{busy ? "Confirmando..." : "Confirmar entrega"}</button></form>
    {error && <p className="delivery-confirm-error" role="alert">{error}</p>}
  </div>;
}

export default function DeliveryDashboard() {
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/delivery/orders", { cache: "no-store" });
    const result = await response.json() as DeliveryData;
    if (response.status === 403) { setData(null); return; }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar as entregas.");
    setData(result);
    setError("");
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load().catch(failure => setError(failure.message)).finally(() => setLoading(false)); }, 0);
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/delivery/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      setPassword("");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/delivery/logout", { method: "POST" });
    setData(null);
    setShowCompleted(false);
  }

  const orders = data?.orders.filter(order => (order.status === "completed") === showCompleted) ?? [];
  const activeCount = data?.orders.filter(order => order.status !== "completed").length ?? 0;
  const completedCount = (data?.orders.length ?? 0) - activeCount;

  return <div className="delivery-page">
    <header className="delivery-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><span><Truck size={17} /> Área dos entregadores</span></header>
    <main className="delivery-wrap">
      <div className="delivery-heading"><p className="section-kicker">30 de outubro · entregas a partir das 18h</p><h1>Entregas</h1><p>Endereços e contatos dos pedidos para entrega. A lista atualiza a cada 10 segundos.</p></div>
      {error && <div className="team-error" role="alert">{error}</div>}
      {loading && <div className="delivery-empty" role="status">Carregando entregas...</div>}
      {!loading && !data && <form className="delivery-login" onSubmit={login}><h2>Acesso dos entregadores</h2><p>Use a senha da equipe de delivery.</p><label htmlFor="delivery-password">Senha dos entregadores</label><input id="delivery-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button></form>}
      {data && <>
        <div className="delivery-toolbar"><div className="delivery-filters" role="group" aria-label="Filtrar entregas"><button type="button" className={!showCompleted ? "active" : ""} aria-pressed={!showCompleted} onClick={() => setShowCompleted(false)}>Em andamento <span>{activeCount}</span></button><button type="button" className={showCompleted ? "active" : ""} aria-pressed={showCompleted} onClick={() => setShowCompleted(true)}>Entregues <span>{completedCount}</span></button></div><button type="button" className="delivery-refresh" onClick={() => void load()}><RefreshCw size={16} /> Atualizar</button><button type="button" className="delivery-logout" onClick={() => void logout()}>Sair</button></div>
        <div className="delivery-list">{orders.length ? orders.map(order => {
          const phoneHref = deliveryPhoneHref(order.phone);
          const mapHref = order.address ? deliveryDirectionsUrl(order.address, order.neighborhood) : null;
          return <details className="delivery-card" key={order.id}>
            <summary className="delivery-card-summary">
              <div className="delivery-card-head"><div><small>Pedido #{order.id.slice(0, 8).toUpperCase()}</small><h2>{order.name}</h2></div><div className="delivery-card-status"><span className="team-status">{statusLabels[order.status] ?? order.status}</span><ChevronDown size={19} aria-hidden="true" /></div></div>
              <p className="delivery-address"><MapPinned size={19} /><span>{order.address || "Endereço não informado"}{order.neighborhood ? ` · ${order.neighborhood}` : ""}</span></p>
              <span className="delivery-card-hint">{order.status === "out_for_delivery" ? "Abrir pedido para informar o código" : "Abrir detalhes do pedido"}</span>
            </summary>
            <div className="delivery-card-body">
              <div className="delivery-actions">{mapHref && <a className="delivery-map" href={mapHref} target="_blank" rel="noreferrer" referrerPolicy="no-referrer"><MapPinned size={17} /> Abrir rota no Google Maps <ArrowUpRight size={15} /></a>}{phoneHref && <a className="delivery-phone" href={phoneHref}><Phone size={17} /> Ligar para {order.phone}</a>}</div>
              <p className="delivery-items">{order.items.map(item => `${item.quantity}× ${item.name}`).join(" · ")}</p>
              {order.notes && <p className="delivery-note"><strong>Observação:</strong> {order.notes}</p>}
              {order.status === "out_for_delivery" && <DeliveryConfirmation orderId={order.id} onConfirmed={load} />}
              {order.status === "completed" && <p className="delivery-confirmed" role="status">✓ Entrega confirmada{order.confirmedAt ? ` em ${new Date(order.confirmedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}.</p>}
            </div>
          </details>;
        }) : <div className="delivery-empty">{showCompleted ? "Nenhuma entrega concluída." : "Nenhuma entrega em andamento."}</div>}</div>
      </>}
    </main>
  </div>;
}
