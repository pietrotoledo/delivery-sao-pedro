"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Heart, MapPinned, MessageCircle, RefreshCw, Truck, UserRound } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import { addressWithNeighborhood, deliveryWhatsappHref } from "@/lib/delivery-links";
import { canJoinRoute, defaultRoutePoint, planDeliveryRoute, sortByNeighborhood } from "@/lib/delivery-routing";
import { eventLocation } from "@/lib/event-location";
import DeliveryAssignedRoutes from "./delivery-assigned-routes";
import useDeliverySync from "./use-delivery-sync";

type DeliveryOrder = {
  id: string; name: string; neighborhood: string | null; address: string | null; status: string; feeToArrange?: boolean;
  phone: string; routeId?: string | null; driverName?: string | null; routePosition?: number | null;
};
type DeliveryData = { orders: DeliveryOrder[]; error?: string };

const statusLabels: Record<string, string> = {
  paid: "Pago", preparing: "Em preparo", ready: "Pronto para sair",
  out_for_delivery: "Saiu para entrega", completed: "Entregue",
};

async function readJson<T>(response: Response): Promise<T> {
  try { return await response.json() as T; }
  catch { throw new Error(response.ok ? "Resposta inválida do servidor. Tente atualizar." : "O servidor está indisponível no momento. Tente atualizar em alguns segundos."); }
}

export default function DeliveryDashboard({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortMode, setSortMode] = useState("proximity");
  const [neighborhood, setNeighborhood] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [driverName, setDriverName] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeError, setRouteError] = useState("");
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const response = await fetch("/api/delivery/orders", { cache: "no-store" });
    if (version !== loadVersion.current) return;
    if (response.status === 403) { setData(null); return; }
    const result = await readJson<DeliveryData>(response);
    if (version !== loadVersion.current) return;
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar as entregas.");
    setData(result);
    setError("");
  }, []);
  const synced = useDeliverySync(Boolean(data), load);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load().catch(failure => setError(failure.message)).finally(() => setLoading(false)); }, 0);
    const timer = window.setInterval(() => { void load().catch(() => {}); }, 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/delivery/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await readJson<{ error?: string }>(response);
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
    setSelectedIds([]);
    setDriverName("");
    setRouteError("");
  }

  const visibleOrders = data?.orders.filter(order => (order.status === "completed") === showCompleted) ?? [];
  const neighborhoods = [...new Set(visibleOrders.map(order => order.neighborhood).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filteredOrders = visibleOrders.filter(order => !neighborhood || order.neighborhood === neighborhood);
  const orders = !showCompleted && sortMode === "proximity" ? sortByNeighborhood(filteredOrders, defaultRoutePoint) : filteredOrders;
  const route = planDeliveryRoute(data?.orders.filter(order => selectedIds.includes(order.id) && !order.routeId) ?? [], defaultRoutePoint);
  const routePositions = new Map(route.map((order, index) => [order.id, index + 1]));
  function toggleRoute(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  async function saveRoute() {
    setSavingRoute(true); setRouteError("");
    try {
      const response = await fetch("/api/delivery/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", driverName, orderIds: route.map(order => order.id) }) });
      const result = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a rota.");
      setSelectedIds([]);
      await load();
    } catch (failure) { setRouteError(failure instanceof Error ? failure.message : "Não foi possível salvar a rota."); void load().catch(() => {}); }
    finally { setSavingRoute(false); }
  }
  async function releaseRoute(id: string) {
    if (!window.confirm("Liberar as entregas pendentes desta rota para outro entregador? As concluídas ficam no histórico.")) return;
    setSavingRoute(true); setRouteError("");
    try {
      const response = await fetch("/api/delivery/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", routeId: id }) });
      const result = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Não foi possível liberar a rota.");
      await load();
    } catch (failure) { setRouteError(failure instanceof Error ? failure.message : "Não foi possível liberar a rota."); }
    finally { setSavingRoute(false); }
  }
  async function reassignRoute(id: string) {
    const name = window.prompt("Nome do entregador que vai assumir as entregas pendentes desta rota:");
    if (!name?.trim()) return;
    setSavingRoute(true); setRouteError("");
    try {
      const response = await fetch("/api/delivery/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reassign", routeId: id, driverName: name }) });
      const result = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Não foi possível trocar o entregador.");
      await load();
    } catch (failure) { setRouteError(failure instanceof Error ? failure.message : "Não foi possível trocar o entregador."); }
    finally { setSavingRoute(false); }
  }
  const activeCount = data?.orders.filter(order => order.status !== "completed").length ?? 0;
  const completedCount = (data?.orders.length ?? 0) - activeCount;

  return <div className={embedded ? "delivery-admin-embedded" : "delivery-page"}>
    {!embedded && <header className="delivery-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><span><Truck size={17} /> Área dos entregadores</span></header>}
    <div className={embedded ? "delivery-admin-content" : "delivery-wrap"}>
      {!embedded && <section className="delivery-heading delivery-dashboard-heading" aria-labelledby="delivery-title">
        <p className="delivery-date"><span>30 de outubro</span><span>Entregas a partir das 19h</span></p>
        <h1 id="delivery-title">Entregas</h1>
        <div className="delivery-gratitude"><Heart size={18} fill="currentColor" aria-hidden="true" /><p>Seu caminho faz esta noite chegar mais longe. Obrigado por entregar cada pedido com cuidado e levar junto um pouco do nosso carinho.</p></div>
      </section>}
      {error && <div className="team-error" role="alert">{error}</div>}
      {loading && <div className="delivery-empty" role="status">Carregando entregas...</div>}
      {!loading && !data && <form className="delivery-login" onSubmit={login}><h2>Acesso dos entregadores</h2><p>Use a senha da equipe de delivery.</p><label htmlFor="delivery-password">Senha dos entregadores</label><input id="delivery-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button></form>}
      {data && <>
        <p className={`delivery-sync-state ${synced ? "is-live" : ""}`} role="status">{synced ? "Sincronização ao vivo conectada" : "Reconectando a sincronização · atualização periódica ativa"}</p>
        <div className="delivery-toolbar"><div className="delivery-filters" role="group" aria-label="Filtrar entregas"><button type="button" className={!showCompleted ? "active" : ""} aria-pressed={!showCompleted} onClick={() => { setShowCompleted(false); setNeighborhood(""); }}>Em andamento <span>{activeCount}</span></button><button type="button" className={showCompleted ? "active" : ""} aria-pressed={showCompleted} onClick={() => { setShowCompleted(true); setNeighborhood(""); }}>Entregues <span>{completedCount}</span></button></div><div className="delivery-tools"><button type="button" className="delivery-refresh" onClick={() => void load().catch(failure => setError(failure.message))}><RefreshCw size={16} /> Atualizar</button>{!embedded && <button type="button" className="delivery-logout" onClick={() => void logout()}>Sair</button>}</div></div>
        <div className="delivery-route-filters">
          {!showCompleted && <label>Ordenar pedidos<select value={sortMode} onChange={event => setSortMode(event.target.value)}><option value="proximity">Bairros mais próximos de Manaíra</option><option value="status">Ordem de preparo</option></select></label>}
          <label>Bairro<select value={neighborhood} onChange={event => setNeighborhood(event.target.value)}><option value="">Todos os bairros</option>{neighborhoods.map(name => <option key={name}>{name}</option>)}</select></label>
        </div>
        {!showCompleted && <section className="delivery-route-planner" aria-labelledby="delivery-route-title">
          <div className="delivery-route-heading"><MapPinned size={23} aria-hidden="true" /><h2 id="delivery-route-title">Monte sua rota de entregas</h2></div>
          <p>Saída: <strong>{eventLocation.name}, em Manaíra.</strong> Marque os pedidos prontos ou que já saíram para entrega para levar na mesma viagem.</p>
          <p className="delivery-route-note">A proximidade é aproximada, pelo centro dos bairros. O Maps calcula o caminho pelas ruas usando os endereços completos.</p>
          <label className="delivery-driver-field" htmlFor="delivery-driver-name">{embedded ? "Nome do entregador responsável" : "Seu nome de entregador"}<input id="delivery-driver-name" value={driverName} onChange={event => setDriverName(event.target.value)} maxLength={60} autoComplete={embedded ? "off" : "name"} placeholder="Ex.: João, Pedro ou Ana" disabled={savingRoute} /></label>
          {route.length > 0 ? <>
            <div className="delivery-route-summary"><strong>{route.length} entrega{route.length === 1 ? " selecionada" : "s selecionadas"}</strong><button type="button" onClick={() => setSelectedIds([])}>Limpar seleção</button></div>
            <ol className="delivery-route-stops">{route.map(order => <li key={order.id}><span><strong>{order.neighborhood || "Bairro não informado"}</strong> · Pedido #{order.id.slice(0, 8).toUpperCase()}</span><button type="button" aria-label={`Remover pedido ${order.id.slice(0, 8).toUpperCase()} da rota`} onClick={() => toggleRoute(order.id)}>Remover</button></li>)}</ol>
            <p className="delivery-route-note">{embedded ? "Salve a rota com o nome de quem vai levar. A atribuição aparece para todos os entregadores." : "Salve a rota no seu nome antes de sair. Os outros entregadores verão que esses pedidos estão com você."}</p>
            <div className="delivery-route-actions"><button className="button button-yellow" type="button" disabled={savingRoute || driverName.trim().length < 2 || route.length > 40} onClick={() => void saveRoute()}><UserRound size={18} aria-hidden="true" />{savingRoute ? "Salvando..." : embedded ? "Atribuir rota ao entregador" : "Salvar rota no meu nome"}</button></div>
            {route.length > 40 && <p className="form-error">Selecione até 40 entregas por rota.</p>}
          </> : <p className="delivery-route-note">Selecione as entregas abaixo para gerar o trajeto.</p>}
        </section>}
        {routeError && <p className="form-error" role="alert">{routeError}</p>}
        {!showCompleted && <DeliveryAssignedRoutes orders={data.orders} busy={savingRoute} onRelease={id => void releaseRoute(id)} onReassign={embedded ? id => void reassignRoute(id) : undefined} />}
        <p className="delivery-list-intro">Toque em um pedido para ver os detalhes e informar o código. A lista sincroniza automaticamente entre a equipe.</p>
        <div className="delivery-list">{orders.length ? orders.map(order => <article className="delivery-card" key={order.id}><a className="delivery-card-link" href={`/entregas/pedido/${encodeURIComponent(order.id)}`}>
          <div className="delivery-card-head"><div><small>Pedido #{order.id.slice(0, 8).toUpperCase()}</small><h2>{order.name}</h2></div><span className="team-status">{statusLabels[order.status] ?? order.status}</span></div>
          <p className="delivery-address"><MapPinned size={19} /><span>{addressWithNeighborhood(order.address, order.neighborhood) || "Endereço não informado"}</span></p>
          {order.driverName && <p className="delivery-driver-badge"><UserRound size={16} aria-hidden="true" /> Entregador: <strong>{order.driverName}</strong> · Rota #{order.routeId?.slice(0, 6).toUpperCase()}</p>}
          {order.feeToArrange && <p className="delivery-fee-arrange"><BadgeDollarSign size={18} aria-hidden="true" /><span>Frete a combinar: não está no Pix. O valor do Uber Moto é combinado com o cliente pelo WhatsApp.</span></p>}
          <span className="delivery-card-hint">{order.status === "out_for_delivery" ? "Abrir pedido e informar código" : "Ver pedido"} <ArrowRight size={16} aria-hidden="true" /></span>
        </a>{deliveryWhatsappHref(order.phone ?? "", order.id, order.driverName ?? undefined) && <a className="delivery-whatsapp" href={deliveryWhatsappHref(order.phone, order.id, order.driverName ?? undefined)!} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" /> WhatsApp do cliente</a>}{!showCompleted && <div className="delivery-route-choice">{order.routeId ? <span>Este pedido já está na rota de <strong>{order.driverName}</strong>.</span> : canJoinRoute(order) ? <label><input type="checkbox" aria-label={`Incluir pedido ${order.id.slice(0, 8).toUpperCase()} na rota`} checked={routePositions.has(order.id)} disabled={savingRoute} onChange={() => toggleRoute(order.id)} /><span>{routePositions.has(order.id) ? `Parada ${routePositions.get(order.id)} da rota` : "Incluir na rota"}</span></label> : <span>{order.address?.trim() ? "Disponível para a rota quando estiver pronto para sair." : "Informe o endereço antes de incluir na rota."}</span>}</div>}</article>) : <div className="delivery-empty">{neighborhood ? "Nenhuma entrega neste bairro." : showCompleted ? "Nenhuma entrega concluída." : "Nenhuma entrega em andamento."}</div>}</div>
      </>}
    </div>
  </div>;
}
