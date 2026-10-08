"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CirclePause, Clock3, PackageCheck, RefreshCw } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import AdminProducts from "./admin-products";

type Order = {
  id: string; created_at: string; name: string; phone: string; email: string | null; method: string;
  neighborhood: string | null; address: string | null; notes: string | null;
  items_json: string; burger_count: number; subtotal: number;
  delivery_fee: number | null; total: number | null; status: string;
  paid_at: string | null; payment_mode: string | null; refund_note: string | null;
};
type AdminData = { orders: Order[]; settings: { capacity: number; paused: boolean }; paid: number; demo: boolean; error?: string };
type Filter = "all" | "attention" | "active" | "closed";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = {
  awaiting_quote: "Aguardando taxa", ready_for_payment: "Aguardando Pix",
  awaiting_payment: "Aguardando Pix", paid: "Pago", preparing: "Em preparo",
  ready: "Pronto", out_for_delivery: "Saiu para entrega",
  completed: "Concluído", refunded: "Devolução registrada",
};
const names: Record<string, string> = {
  classic: "Clássico", bacon: "Bacon", "fries-small": "Batata pequena",
  "fries-large": "Batata grande", water: "Água mineral",
  coke: "Coca-Cola", "coke-zero": "Coca-Cola Zero",
};
const closedStatuses = new Set(["completed", "refunded"]);

export default function AdminDashboard({ view = "orders" }: { view?: "orders" | "products" }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [capacity, setCapacity] = useState(100);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/admin");
    const result = await response.json() as AdminData;
    if (!response.ok) throw new Error(result.error || "Acesso restrito.");
    setData(result);
    setCapacity(result.settings.capacity);
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      load().catch(failure => setError(failure.message)).finally(() => setLoading(false));
    }, 0);
    const timer = setInterval(() => load().catch(() => {}), 10000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  const paidOrders = data?.orders.filter(order => order.paid_at && order.status !== "refunded") ?? [];
  const revenue = paidOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const pendingQuotes = data?.orders.filter(order => order.status === "awaiting_quote").length ?? 0;
  const openOrders = data?.orders.filter(order => !closedStatuses.has(order.status)).length ?? 0;
  const over = Math.max(0, (data?.paid ?? 0) - (data?.settings.capacity ?? 100));
  const paidPosition = new Map<string, { start: number; end: number }>();
  let running = 0;
  for (const order of [...paidOrders].sort((a, b) => (a.paid_at || "").localeCompare(b.paid_at || ""))) {
    const start = running + 1;
    running += order.burger_count;
    paidPosition.set(order.id, { start, end: running });
  }
  const visibleOrders = data?.orders.filter(order => {
    if (filter === "attention") return order.status === "awaiting_quote";
    if (filter === "active") return !closedStatuses.has(order.status) && order.status !== "awaiting_quote";
    if (filter === "closed") return closedStatuses.has(order.status);
    return true;
  }) ?? [];

  async function changeSettings(next: { capacity: number; paused: boolean }) {
    setError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao salvar."); }
  }

  async function orderAction(id: string, body: Record<string, unknown>) {
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao atualizar.");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao atualizar."); }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Acesso negado.");
      setPassword("");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível entrar."); }
  }

  return <div className="admin-shell">
    <aside className="admin-side">
      <Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link>
      <nav className="side-nav" aria-label="Painel"><Link className={view === "orders" ? "active" : ""} href="/admin">Pedidos</Link><Link className={view === "products" ? "active" : ""} href="/admin/produtos">Produtos</Link><Link href="/">Ver loja</Link></nav>
      <p className="side-foot">Equipe · 29 de outubro de 2026</p>
    </aside>
    <main className="admin-main">
      <header className="admin-head">
        <div><p className="section-kicker">Painel da equipe</p><h1>{view === "products" ? "Cardápio" : "Controle da noite"}</h1><p>{view === "products" ? "Gerencie os produtos que aparecem na loja." : "Pedidos e pagamentos atualizados a cada 10 segundos."}</p></div>
        <Link href="/" target="_blank" rel="noreferrer">Abrir loja <ArrowUpRight size={16} /></Link>
      </header>
      <nav className="admin-tabs" aria-label="Seções do painel"><Link href="/admin" className={view === "orders" ? "active" : ""}>Pedidos</Link><Link href="/admin/produtos" className={view === "products" ? "active" : ""}>Produtos</Link></nav>
      {error && <div className="admin-alert" role="alert">{error} {!data && <a href="/signin-with-chatgpt?return_to=/admin" target="_top">Entrar com ChatGPT</a>}</div>}
      {loading && <div className="admin-panel" role="status">Carregando painel...</div>}
      {!loading && !data && <form className="admin-panel admin-login" onSubmit={login}>
        <h2>Acesso da equipe</h2>
        <p>Entre com a senha do painel ou com sua conta autorizada do Site privado.</p>
        <div className="admin-controls"><input type="password" aria-label="Senha do painel" placeholder="Senha do painel" value={password} onChange={event => setPassword(event.target.value)} /><button type="submit">Entrar</button></div>
      </form>}
      {data && view === "products" && <AdminProducts />}
      {data && view === "orders" && <>
        <section id="visao-geral" className="metric-grid" aria-label="Resumo dos pedidos">
          <div className={`metric ${data.paid >= data.settings.capacity ? "warning" : ""}`}><span>Hambúrgueres pagos</span><strong>{data.paid} <small>/ {data.settings.capacity}</small></strong><div className="progress-track"><div style={{ width: `${Math.min(100, data.paid / data.settings.capacity * 100)}%` }} /></div></div>
          <div className="metric"><span>Pedidos em andamento</span><strong>{openOrders}</strong><small>{pendingQuotes} aguardando taxa</small></div>
          <div className="metric"><span>Total recebido</span><strong className="metric-money">{money(revenue)}</strong><small>Exclui devoluções registradas</small></div>
        </section>
        {data.paid >= data.settings.capacity && <div className="admin-alert">A capacidade de {data.settings.capacity} hambúrgueres foi atingida. Revise os pedidos excedentes, aumente a capacidade ou pause novas compras.</div>}
        {over > 0 && <div className="admin-alert">{over} hambúrguer{over === 1 ? "" : "es"} acima da capacidade atual. Considere a ordem de confirmação do pagamento.</div>}
        {data.demo && <div className="admin-alert">Modo de demonstração. Simular pagamento não movimenta dinheiro.</div>}
        <section className="admin-panel admin-operations">
          <div className="admin-panel-heading"><div><p className="section-kicker">Operação</p><h2>Vendas e capacidade</h2></div><span className={`operation-state ${data.settings.paused ? "is-paused" : ""}`}>{data.settings.paused ? <CirclePause size={16} /> : <PackageCheck size={16} />}{data.settings.paused ? "Pedidos pausados" : "Pedidos abertos"}</span></div>
          <div className="admin-controls"><label htmlFor="capacity">Limite de hambúrgueres</label><input id="capacity" type="number" min="1" max="10000" value={capacity} onChange={event => setCapacity(Number(event.target.value))} /><button onClick={() => changeSettings({ capacity, paused: data.settings.paused })}>Salvar limite</button><button className="secondary" onClick={() => changeSettings({ capacity: data.settings.capacity, paused: !data.settings.paused })}>{data.settings.paused ? "Reabrir pedidos" : "Pausar pedidos"}</button></div>
          <p className="admin-help">Devoluções registradas saem do contador e liberam vaga.</p>
        </section>
        <section className="admin-panel admin-orders-panel" id="pedidos">
          <div className="admin-panel-heading"><div><p className="section-kicker">Acompanhar</p><h2>Pedidos <span>({data.orders.length})</span></h2></div><span className="admin-refresh"><RefreshCw size={15} /> Atualização automática</span></div>
          <div className="admin-filters" role="group" aria-label="Filtrar pedidos">
            {([
              ["all", "Todos", data.orders.length],
              ["attention", "Aguardando taxa", pendingQuotes],
              ["active", "Em andamento", openOrders - pendingQuotes],
              ["closed", "Concluídos", data.orders.length - openOrders],
            ] as [Filter, string, number][]).map(([value, label, count]) => <button key={value} type="button" className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>)}
          </div>
          <div className="admin-orders">
            {visibleOrders.length === 0 && <p className="admin-empty">{filter === "all" ? "Os pedidos aparecerão aqui assim que alguém finalizar a compra." : "Nenhum pedido nesta situação."}</p>}
            {visibleOrders.map(order => {
 feat/checkout-sugestoes-personalizacao
              const products = JSON.parse(order.items_json) as { id: string; quantity: number; name?: string; removed?: string[] }[];
              const position = paidPosition.get(order.id);
              return <article className="admin-order" key={order.id}>
                <div className="admin-order-top"><div><h3>{order.name} <small>#{order.id.slice(0, 8).toUpperCase()}</small></h3><small>{new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {order.phone}{order.email ? ` · ${order.email}` : ""}</small></div><span className="status-pill">{labels[order.status] || order.status}</span></div>
                <p className="admin-order-items">{products.map(item => `${item.quantity}× ${item.name || names[item.id] || item.id}${item.removed?.length ? ` (sem ${item.removed.join(", sem ").toLowerCase()})` : ""}`).join(" · ")}</p>

              const products = JSON.parse(order.items_json) as { id: string; quantity: number; name?: string; removedIngredients?: string[] }[];
              const position = paidPosition.get(order.id);
              return <article className="admin-order" key={order.id}>
                <div className="admin-order-top"><div><h3>{order.name} <small>#{order.id.slice(0, 8).toUpperCase()}</small></h3><small>{new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {order.phone}{order.email ? ` · ${order.email}` : ""}</small></div><span className="status-pill">{labels[order.status] || order.status}</span></div>
                <p className="admin-order-items">{products.map(item => `${item.quantity}× ${item.name || names[item.id] || item.id}${item.removedIngredients?.length ? ` (SEM: ${item.removedIngredients.join(", ")})` : ""}`).join(" · ")}</p>
 main
                <div className="admin-order-facts"><span>{order.method === "delivery" ? `Entrega · ${order.address} · ${order.neighborhood}` : "Retirada na paróquia"}</span><strong>{order.total === null ? "Total a definir" : money(order.total)}</strong></div>
                {order.notes && <p className="admin-order-note">Observação: {order.notes}</p>}
                {position && <p className="admin-order-priority"><Clock3 size={14} /> Prioridade pelo pagamento: hambúrgueres {position.start}–{position.end}{position.end > data.settings.capacity ? " · acima da capacidade" : ""}</p>}
                <div className="admin-order-actions">
                  {order.status === "awaiting_quote" && <><input aria-label="Taxa de entrega em reais" type="number" min="0" max="100" step=".01" placeholder="Taxa em R$" value={feeInputs[order.id] ?? ""} onChange={event => setFeeInputs(current => ({ ...current, [order.id]: event.target.value }))} /><button className="mini-button" onClick={() => orderAction(order.id, { action: "quote", fee: Math.round(Number(feeInputs[order.id]) * 100) })}>Definir taxa</button></>}
                  {data.demo && order.total !== null && !order.paid_at && <button className="mini-button" onClick={() => orderAction(order.id, { action: "demo_paid" })}>Simular pagamento</button>}
                  {order.paid_at && order.status !== "refunded" && <><select aria-label="Atualizar situação" value={order.status} onChange={event => orderAction(order.id, { action: "status", status: event.target.value })}><option value="paid">Pago</option><option value="preparing">Em preparo</option><option value="ready">Pronto</option><option value="out_for_delivery">Saiu para entrega</option><option value="completed">Concluído</option></select><button className="mini-button secondary" onClick={() => { const note = window.prompt("Depois de devolver o valor fora do sistema, registre aqui o motivo ou referência da devolução:"); if (note) orderAction(order.id, { action: "refund", note }); }}>Registrar devolução</button></>}
                  {order.refund_note && <small>Devolução: {order.refund_note}</small>}
                  <a className="mini-button secondary" href={`/pedido/${order.id}`} target="_blank" rel="noreferrer">Ver pedido</a>
                </div>
              </article>;
            })}
          </div>
        </section>
      </>}
    </main>
  </div>;
}
