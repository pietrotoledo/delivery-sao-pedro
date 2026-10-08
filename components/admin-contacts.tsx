"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, Download, ExternalLink, Mail, MessageCircle, Search } from "lucide-react";

type ContactOrder = {
  id: string; created_at: string; name: string; phone: string; email: string | null;
  method: string; neighborhood: string | null; address: string | null;
  subtotal: number; delivery_fee: number | null; total: number | null;
  status: string; checkout_url: string | null; paid_at: string | null;
};
type Result = { orders?: ContactOrder[]; total?: number; page?: number; error?: string };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const code = (id: string) => id.slice(0, 8).toUpperCase();
const statusNames: Record<string, string> = {
  awaiting_quote: "Aguardando taxa", ready_for_payment: "Aguardando Pix",
  awaiting_payment: "Aguardando Pix", paid: "Pago", preparing: "Em preparo",
  ready: "Pronto", out_for_delivery: "Em entrega", completed: "Concluído", refunded: "Devolução registrada",
};

function contactMessage(order: ContactOrder) {
  const lines = [
    `Olá, ${order.name.replace(/[\r\n]+/g, " ")}! Seu pedido Blueckyardigans é #${code(order.id)}.`,
    order.total === null ? "A taxa de entrega ainda será informada." : `Total: ${money(order.total)}.`,
    `Acompanhe seu pedido: ${window.location.origin}/pedido/${order.id}`,
  ];
  if (order.status === "refunded") lines.push("Este pedido teve uma devolução registrada. Consulte a equipe para mais detalhes.");
  else if (order.paid_at) lines.push("Pagamento confirmado.");
  else if (order.checkout_url) lines.push(`Link para pagar com Pix: ${order.checkout_url}`);
  else if (order.total !== null) lines.push("O link Pix será enviado após a geração pela equipe.");
  return lines.join("\n");
}

function whatsappUrl(order: ContactOrder) {
  const digits = order.phone.replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(contactMessage(order))}`;
}

function emailUrl(order: ContactOrder) {
  return `mailto:${encodeURIComponent(order.email ?? "")}?subject=${encodeURIComponent(`Pedido #${code(order.id)} — Blueckyardigans`)}&body=${encodeURIComponent(contactMessage(order))}`;
}

export default function AdminContacts({ demo }: { demo: boolean }) {
  const [orders, setOrders] = useState<ContactOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    const response = await fetch(`/api/admin/contacts?${params}`, { cache: "no-store" });
    const result = await response.json() as Result;
    if (!response.ok || !result.orders) throw new Error(result.error || "Não foi possível carregar os contatos.");
    setOrders(result.orders);
    setTotal(result.total ?? 0);
  }, [page, search]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      load().catch(failure => setError(failure.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setLoading(true);
    const next = query.trim();
    if (page === 0 && next === search) load().catch(failure => setError(failure.message)).finally(() => setLoading(false));
    else { setPage(0); setSearch(next); }
  }

  async function generateLink(id: string) {
    setError(""); setNotice(""); setBusyId(id);
    try {
      const response = await fetch(`/api/admin/orders/${id}/payment-link`, { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Não foi possível gerar o link Pix.");
      setOrders(current => current.map(order => order.id === id ? { ...order, checkout_url: result.url!, status: "awaiting_payment" } : order));
      setNotice(`Link Pix do pedido #${code(id)} pronto para compartilhar.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível gerar o link Pix."); }
    finally { setBusyId(null); }
  }

  async function deleteContact(order: ContactOrder) {
    if (!window.confirm(`Apagar os dados de contato de ${order.name} (pedido #${code(order.id)})? O pedido continuará no painel sem nome, telefone, e-mail e endereço.`)) return;
    setError(""); setNotice(""); setBusyId(order.id);
    try {
      const response = await fetch(`/api/admin/contacts/${order.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível apagar o contato.");
      if (page > 0 && orders.length === 1) setPage(current => current - 1);
      else await load();
      setNotice(`Contato do pedido #${code(order.id)} removido.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível apagar o contato."); }
    finally { setBusyId(null); }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copiado.`); setError(""); }
    catch { setError("Não foi possível copiar. Selecione e copie o texto manualmente."); }
  }

  return <section className="admin-contacts">
    <div className="admin-contacts-heading"><div><p className="section-kicker">Contato e cobrança</p><h2>Clientes e pedidos</h2><p>Consulte os dados registrados em cada pedido e prepare o envio do código e do link Pix.</p></div><a className="admin-primary" href="/api/admin/contacts/export" download><Download size={17} /> Baixar todos os dados (CSV)</a></div>
    <p className="admin-contact-help">WhatsApp e E-mail abrem a mensagem para revisão antes do envio.</p>
    <form className="admin-contact-search" onSubmit={submitSearch}><label htmlFor="contact-search">Buscar por nome, WhatsApp, e-mail ou código</label><div><Search size={18} /><input id="contact-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, contato ou ID do pedido" /><button type="submit">Buscar</button></div></form>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {notice && <p className="admin-success" role="status">{notice}</p>}
    <p className="admin-contact-count">{loading ? "Carregando pedidos..." : `${total} ${total === 1 ? "pedido encontrado" : "pedidos encontrados"}`}</p>
    {!loading && orders.length === 0 && <div className="admin-panel admin-empty">Nenhum pedido encontrado.</div>}
    <div className="admin-contact-list">{!loading && orders.map(order => <article className="admin-contact-card" key={order.id}>
      <div className="admin-contact-card-top"><div><span className="product-category">Pedido #{code(order.id)}</span><h3>{order.name}</h3><small>{new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {order.method === "delivery" ? "Entrega" : "Retirada"}</small></div><span className="status-pill">{statusNames[order.status] || order.status}</span></div>
      <div className="admin-contact-facts"><span><b>WhatsApp</b>{order.phone}</span><span><b>E-mail</b>{order.email || "Não informado"}</span><span><b>Total</b>{order.total === null ? "A definir" : money(order.total)}</span></div>
      {order.method === "delivery" && <p className="admin-contact-address">{order.address} · {order.neighborhood}</p>}
      <div className="admin-contact-payment">{order.status === "refunded" ? <span>Devolução registrada. Link Pix indisponível.</span> : order.paid_at ? <span>Pagamento confirmado.</span> : order.total === null ? <span>Defina a taxa de entrega na aba <Link href="/admin">Pedidos</Link> antes de gerar o Pix.</span> : order.checkout_url ? <><span>Link Pix pronto</span><a href={order.checkout_url} target="_blank" rel="noreferrer">Abrir link <ExternalLink size={14} /></a><button type="button" onClick={() => copy(order.checkout_url!, "Link Pix")}>Copiar link</button></> : demo ? <span>Link Pix indisponível no modo de demonstração.</span> : <button type="button" className="admin-primary" disabled={busyId === order.id} onClick={() => generateLink(order.id)}>{busyId === order.id ? "Gerando Pix..." : "Gerar link Pix"}</button>}</div>
      <div className="admin-contact-actions"><button type="button" onClick={() => copy(code(order.id), "Código do pedido")}><Copy size={15} /> Copiar código</button><button type="button" onClick={() => copy(contactMessage(order), "Mensagem")}><Copy size={15} /> Copiar mensagem</button><a href={whatsappUrl(order)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>{order.email && <a href={emailUrl(order)}><Mail size={16} /> E-mail</a>}<a href={`/pedido/${order.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver pedido</a><button className="danger" type="button" disabled={busyId === order.id} onClick={() => deleteContact(order)}>Apagar contato</button></div>
    </article>)}</div>
    {!loading && total > 100 && <div className="admin-contact-pages"><button type="button" disabled={page === 0} onClick={() => { setPage(current => current - 1); setLoading(true); }}><ArrowLeft size={16} /> Anterior</button><span>Página {page + 1} de {Math.ceil(total / 100)}</span><button type="button" disabled={(page + 1) * 100 >= total} onClick={() => { setPage(current => current + 1); setLoading(true); }}>Próxima <ArrowRight size={16} /></button></div>}
  </section>;
}
