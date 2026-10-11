"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, KeyRound, MapPinned, Phone, Truck } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import { deliveryDirectionsUrl, deliveryPhoneHref } from "@/lib/delivery-links";

type DeliveryOrder = {
  id: string; createdAt: string; name: string; phone: string;
  neighborhood: string | null; address: string | null; notes: string | null;
  items: {name: string; quantity: number}[]; status: string; confirmedAt: string | null;
};

const statusLabels: Record<string, string> = {
  paid: "Pago", preparing: "Em preparo", ready: "Pronto para sair",
  out_for_delivery: "Saiu para entrega", completed: "Entregue",
};

export default function DeliveryOrderDetail({id}: {id: string}) {
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/delivery/orders/${encodeURIComponent(id)}`, {cache: "no-store"});
    const result = await response.json() as {order?: DeliveryOrder; error?: string};
    if (response.status === 403) { setRestricted(true); setOrder(null); return; }
    if (!response.ok || !result.order) {
      if (response.status === 404) setOrder(null);
      throw new Error(result.error || "Não foi possível carregar o pedido.");
    }
    setOrder(result.order);
    setRestricted(false);
    setError("");
  }, [id]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load().catch(failure => setError(failure.message)).finally(() => setLoading(false)); }, 0);
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) { setConfirmError("Digite os quatro dígitos do código."); return; }
    setBusy(true); setConfirmError("");
    try {
      const response = await fetch(`/api/delivery/orders/${encodeURIComponent(id)}/confirm`, {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({code}),
      });
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error || "Não foi possível confirmar a entrega.");
      setCode("");
      await load();
    } catch (failure) { setConfirmError(failure instanceof Error ? failure.message : "Não foi possível confirmar a entrega."); }
    finally { setBusy(false); }
  }

  const mapHref = order?.address ? deliveryDirectionsUrl(order.address, order.neighborhood) : null;
  const phoneHref = order ? deliveryPhoneHref(order.phone) : null;

  return <div className="delivery-page">
    <header className="delivery-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><span><Truck size={17} /> Área dos entregadores</span></header>
    <main className="delivery-wrap delivery-detail-wrap">
      <Link className="delivery-back" href="/entregas"><ArrowLeft size={17} /> Voltar às entregas</Link>
      <div className="delivery-heading"><p className="section-kicker">{order ? `Pedido #${order.id.slice(0, 8).toUpperCase()}` : "Área dos entregadores"}</p><h1>Detalhes do pedido</h1><p>Confira a entrega e peça o código de verificação ao cliente no recebimento.</p></div>
      {loading && <div className="delivery-empty" role="status">Carregando pedido...</div>}
      {error && <div className="team-error" role="alert">{error}</div>}
      {!loading && restricted && <div className="delivery-empty">Acesse a área dos entregadores para consultar este pedido. <Link href="/entregas">Entrar</Link></div>}
      {order && <article className="delivery-detail-card">
        <div className="delivery-card-head"><div><small>Pedido #{order.id.slice(0, 8).toUpperCase()}</small><h2>{order.name}</h2></div><span className="team-status">{statusLabels[order.status] ?? order.status}</span></div>
        <p className="delivery-address"><MapPinned size={19} /><span>{order.address || "Endereço não informado"}{order.neighborhood ? ` · ${order.neighborhood}` : ""}</span></p>
        <div className="delivery-actions">{mapHref && <a className="delivery-map" href={mapHref} target="_blank" rel="noreferrer" referrerPolicy="no-referrer"><MapPinned size={17} /> Abrir rota no Google Maps <ArrowUpRight size={15} /></a>}{phoneHref && <a className="delivery-phone" href={phoneHref}><Phone size={17} /> Ligar para {order.phone}</a>}</div>
        <section className="delivery-detail-items"><h3>Itens do pedido</h3>{order.items.map((item, index) => <p key={`${item.name}-${index}`}>{item.quantity}× {item.name}</p>)}</section>
        {order.notes && <p className="delivery-note"><strong>Observação:</strong> {order.notes}</p>}
        {order.status === "out_for_delivery" && <section className="delivery-confirm">
          <div className="delivery-confirm-heading"><KeyRound size={19} /><div><strong>Código de verificação</strong><p>Peça ao cliente os quatro últimos dígitos do telefone informado no pedido.</p></div></div>
          <form onSubmit={confirm}><label className="sr-only" htmlFor="delivery-code">Código de verificação do pedido</label><input id="delivery-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} placeholder="0000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} required /><button type="submit" disabled={busy || code.length !== 4}>{busy ? "Confirmando..." : "Confirmar entrega"}</button></form>
          {confirmError && <p className="delivery-confirm-error" role="alert">{confirmError}</p>}
        </section>}
        {order.status === "completed" && <p className="delivery-confirmed" role="status">✓ Entrega confirmada{order.confirmedAt ? ` em ${new Date(order.confirmedAt).toLocaleString("pt-BR", {timeZone: "America/Sao_Paulo"})}` : ""}.</p>}
        {order.status !== "completed" && order.status !== "out_for_delivery" && <p className="delivery-pending">O código poderá ser informado quando o pedido estiver com o status “Saiu para entrega”.</p>}
      </article>}
    </main>
  </div>;
}
