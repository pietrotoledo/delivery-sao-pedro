"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, MapPin, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import BrandAvatar from "@/components/brand-avatar";
import { externalPhoto, productPhoto } from "@/lib/product-images";

type Product = { id: string; name: string; price: number; category: string; description: string; imageUrl: string | null; stock: number | null; ingredients: string[] };
type PublicData = { menu: Product[]; capacity: number; paid: number; paused: boolean; whatsappNotifications?: boolean; emailNotifications?: boolean };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function Checkout({ initialItems }: { initialItems: string }) {
  const submitting = useRef(false);
  const pendingAttempt = useRef<{payload:string;key:string} | null>(null);
  const [data, setData] = useState<PublicData | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const entry of initialItems.split(",")) {
      const [id, count] = entry.split(":");
      const quantity = Number(count);
      if (id && Number.isInteger(quantity) && quantity > 0 && quantity <= 20) initial[id] = quantity;
    }
    return initial;
  });
  const [loadError, setLoadError] = useState(false);
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [neighborhood, setNeighborhood] = useState("Manaíra");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [removals, setRemovals] = useState<Record<string, string[][]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public")
      .then(response => { if (!response.ok) throw new Error("Cardápio indisponível"); return response.json() as Promise<PublicData>; })
      .then(result => {
        try {
          const saved = window.sessionStorage.getItem("blueckyardigans-removals");
          if (saved) {
            const parsed = JSON.parse(saved) as Record<string, string[][]>;
            setRemovals(Object.fromEntries(result.menu.filter(product => product.category === "burger").map(product => [product.id, Array.isArray(parsed[product.id]) ? parsed[product.id].slice(0, 20).map(unit => Array.isArray(unit) ? unit.filter(ingredient => product.ingredients.includes(ingredient)) : []) : []])));
          }
        } catch { /* O pedido continua disponível sem personalizações salvas. */ }
        setData(result);
        setQuantities(current => Object.fromEntries(result.menu.map(product => [product.id, Math.max(0, Math.min(20, product.stock ?? 20, current[product.id] ?? 0))])));
      })
      .catch(() => setLoadError(true));
  }, []);

  const selected = useMemo(() => data?.menu.filter(product => (quantities[product.id] ?? 0) > 0) ?? [], [data, quantities]);
  const burgerCount = selected.reduce((sum, product) => sum + (product.category === "burger" ? quantities[product.id] : 0), 0);
  const itemCount = selected.reduce((sum, product) => sum + quantities[product.id], 0);
  const subtotal = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const getProduct = (id: string) => data?.menu.find(product => product.id === id);
  const friesUpgradePrice = (getProduct("fries-large")?.price ?? 1200) - (getProduct("fries-small")?.price ?? 800);

  useEffect(() => {
    if (!data) return;
    const items = data.menu.filter(product => quantities[product.id] > 0).map(product => `${product.id}:${quantities[product.id]}`).join(",");
    window.history.replaceState(null, "", `/checkout?items=${encodeURIComponent(items)}`);
    try { window.sessionStorage.setItem("blueckyardigans-cart", JSON.stringify(quantities)); }
    catch { /* Os itens continuam disponíveis pela URL do checkout. */ }
  }, [quantities, data]);

  useEffect(() => {
    if (!data) return;
    try { window.sessionStorage.setItem("blueckyardigans-removals", JSON.stringify(removals)); }
    catch { /* As personalizações continuam nesta página. */ }
  }, [removals, data]);

  function change(id: string, delta: number) {
    const product = getProduct(id);
    if (!product) return;
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(20, product.stock ?? 20, (current[id] ?? 0) + delta)) }));
  }

  function toggleRemoval(id: string, unitIndex: number, ingredient: string) {
    if (!getProduct(id)?.ingredients.includes(ingredient)) return;
    setRemovals(current => {
      const units = [...(current[id] ?? [])];
      const chosen = units[unitIndex] ?? [];
      units[unitIndex] = chosen.includes(ingredient) ? chosen.filter(value => value !== ingredient) : [...chosen, ingredient];
      return { ...current, [id]: units };
    });
  }

  function upgradeFries() {
    setQuantities(current => ({ ...current, "fries-small": Math.max(0, (current["fries-small"] ?? 0) - 1), "fries-large": Math.min(20, getProduct("fries-large")?.stock ?? 20, (current["fries-large"] ?? 0) + 1) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!data || burgerCount < 1) { setError("Adicione pelo menos um hambúrguer antes de continuar."); return; }
    submitting.current = true;
    setBusy(true);
    try {
      const items = selected.map(product => ({ id: product.id, quantity: quantities[product.id], unitRemovals: product.category === "burger" ? Array.from({ length: quantities[product.id] }, (_, index) => removals[product.id]?.[index] ?? []) : [] }));
      const payload = JSON.stringify({ name, phone, email, method, neighborhood, address, notes, whatsappOptIn, items, expectedSubtotal: subtotal });
      let attempt = pendingAttempt.current;
      try {
        const saved = window.sessionStorage.getItem("blueckyardigans-order-attempt");
        if (saved) attempt = JSON.parse(saved) as {payload:string;key:string};
      } catch { /* A tentativa continua disponível nesta página. */ }
      if (!attempt || attempt.payload !== payload) attempt = { payload, key: crypto.randomUUID() };
      pendingAttempt.current = attempt;
      try { window.sessionStorage.setItem("blueckyardigans-order-attempt", JSON.stringify(attempt)); }
      catch { /* A chave permanece disponível enquanto a página estiver aberta. */ }
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(payload), requestKey: attempt.key }),
      });
      const result = await response.json() as { id?: string; error?: string; paymentUrl?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Não foi possível criar o pedido.");
      try { window.sessionStorage.removeItem("blueckyardigans-cart"); window.sessionStorage.removeItem("blueckyardigans-removals"); window.sessionStorage.removeItem("blueckyardigans-order-attempt"); } catch { /* O pedido já foi criado. */ }
      window.location.assign(`/pedido/${result.id}${result.paymentUrl ? "?abrir-pix=1" : ""}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível criar o pedido.");
      setBusy(false);
      submitting.current = false;
    }
  }

  const burgerSuggestions = data?.menu.filter(product => product.category === "burger" && product.stock !== 0 && !quantities[product.id]) ?? [];
  const sideSuggestions = data?.menu.filter(product => product.category === "side" && product.stock !== 0 && !quantities[product.id] && !(product.id === "fries-large" && quantities["fries-small"])).sort((a, b) => (a.id === (burgerCount > 1 ? "fries-large" : "fries-small") ? -1 : b.id === (burgerCount > 1 ? "fries-large" : "fries-small") ? 1 : 0)) ?? [];
  const drinkSuggestions = data?.menu.filter(product => product.category === "drink" && product.stock !== 0 && !quantities[product.id]).sort((a, b) => (a.id === "coke" ? -1 : b.id === "coke" ? 1 : 0)) ?? [];
  const canUpgradeFries = Boolean(quantities["fries-small"] && getProduct("fries-large") && (getProduct("fries-large")!.stock === null || (getProduct("fries-large")!.stock ?? 0) > (quantities["fries-large"] ?? 0)));
  const showSuggestions = burgerSuggestions.length > 0 || sideSuggestions.length > 0 || drinkSuggestions.length > 0 || canUpgradeFries;

  return <div className="checkout-page">
    <header className="topbar wrap checkout-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><Link className="checkout-back" href="/" onClick={() => window.sessionStorage.setItem("blueckyardigans-scroll-target", "cardapio")}><ArrowLeft size={17} /> Voltar ao cardápio</Link></header>
    <main className="checkout-main wrap">
      <div className="checkout-heading"><span className="checkout-step">Cardápio <span>›</span> Checkout <span>›</span> Acompanhar pedido</span><h1>Confira e finalize seu pedido.</h1><p>Adicione o que faltar, informe seus dados e veja o total antes de seguir para o Pix.</p></div>
      {loadError && <div className="checkout-alert" role="alert">Não foi possível carregar o cardápio. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>}
      {!data && !loadError && <p role="status">Carregando checkout...</p>}
      {data && <div className="checkout-grid">
        <div className="checkout-flow">
          {showSuggestions && <section className="checkout-panel checkout-suggestions" aria-labelledby="suggestions-title"><div className="checkout-panel-heading"><span className="checkout-panel-number">01</span><div><h2 id="suggestions-title">Complete seu pedido</h2><p>Adicione hambúrgueres, acompanhamentos e bebidas.</p></div></div><div className="suggestion-grid">
            {burgerSuggestions.map(product => <div className="suggestion" key={product.id}><Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={76} height={76} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)}</span></div><button type="button" onClick={() => change(product.id, 1)} disabled={data.paused || burgerCount >= 20} aria-label={`Adicionar ${product.name}`}><Plus size={17} /> Adicionar</button></div>)}
            {sideSuggestions.map(product => <div className="suggestion" key={product.id}><Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={76} height={76} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)}</span></div><button type="button" onClick={() => change(product.id, 1)} disabled={data.paused} aria-label={`Adicionar ${product.name}`}><Plus size={17} /> Adicionar</button></div>)}
            {canUpgradeFries && <div className="suggestion"><Image src={productPhoto(getProduct("fries-large")!)} unoptimized={externalPhoto(productPhoto(getProduct("fries-large")!))} width={76} height={76} alt="" /><div><strong>Prefere batata grande?</strong><span>Troque uma pequena por +{money(friesUpgradePrice)}</span></div><button type="button" onClick={upgradeFries} disabled={data.paused || (quantities["fries-large"] ?? 0) >= 20}><ArrowRight size={17} /> Trocar</button></div>}
            {drinkSuggestions.map(product => <div className="suggestion" key={product.id}><Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={76} height={76} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)}</span></div><button type="button" onClick={() => change(product.id, 1)} disabled={data.paused} aria-label={`Adicionar ${product.name}`}><Plus size={17} /> Adicionar</button></div>)}
          </div></section>}
          <form id="checkout-form" onSubmit={submit}>
            <section className="checkout-panel"><div className="checkout-panel-heading"><span className="checkout-panel-number">{showSuggestions ? "02" : "01"}</span><div><h2>Como vai receber?</h2><p>Escolha a opção mais conveniente.</p></div></div><div className="method-options"><button type="button" className={method === "pickup" ? "selected" : ""} aria-pressed={method === "pickup"} onClick={() => setMethod("pickup")}><MapPin size={20} /><span>Vou retirar<small>30/10 · das 18h às 22h</small></span>{method === "pickup" && <Check size={17} />}</button><button type="button" className={method === "delivery" ? "selected" : ""} aria-pressed={method === "delivery"} onClick={() => setMethod("delivery")}><Truck size={20} /><span>Quero entrega<small>30/10 · a partir das 18h</small></span>{method === "delivery" && <Check size={17} />}</button></div>{method === "pickup" ? <p className="checkout-help">Retirada na Paróquia São Pedro Pescador, Av. Maria Rosa, 1124 · Manaíra, em 30 de outubro, das 18h às 22h.</p> : <p className="checkout-help">As entregas começam em 30 de outubro, às 18h. A taxa será informada antes do Pix.</p>}</section>
            <section className="checkout-panel"><div className="checkout-panel-heading"><span className="checkout-panel-number">{showSuggestions ? "03" : "02"}</span><div><h2>Seus dados</h2><p>Usaremos estes dados para identificar seu pedido.</p></div></div><div className="fields"><label>Nome completo<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Seu nome" required minLength={2} maxLength={100} /></label><label>WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="(83) 99999-9999" required minLength={10} /></label><label>E-mail<input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} /></label>{method === "delivery" && <><label>Bairro<select value={neighborhood} onChange={event => setNeighborhood(event.target.value)}><option>Manaíra</option><option>Bessa</option><option>Tambaú</option></select></label><label>Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} autoComplete="street-address" placeholder="Rua, número, complemento e referência" required minLength={8} maxLength={220} /></label></>}</div>{data.emailNotifications && <p className="checkout-contact-note">Enviaremos o link Pix e as atualizações do pedido para o e-mail informado.</p>}{data.whatsappNotifications && <label className="checkout-whatsapp-consent"><input type="checkbox" checked={whatsappOptIn} onChange={event => setWhatsappOptIn(event.target.checked)} /> Quero receber o link Pix e as atualizações deste pedido pelo WhatsApp.</label>}<details className="notes-details"><summary>Adicionar observação <span>opcional</span></summary><label htmlFor="checkout-notes">Observações do pedido</label><textarea id="checkout-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Alguma informação para a equipe?" rows={2} maxLength={300} /></details></section>
          </form>
        </div>
        <aside className="checkout-summary checkout-panel" aria-label="Resumo do pedido">
          <div className="checkout-panel-heading"><ShoppingBag size={23} /><div><h2>Seu pedido</h2><p>{itemCount} {itemCount === 1 ? "item" : "itens"}</p></div></div>
          <div className="checkout-lines">{selected.length ? selected.map(product => <div className="checkout-line" key={product.id}>
            <Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={60} height={60} alt="" />
            <div><strong>{product.name}</strong><span>{money(product.price)} cada</span><div className="checkout-stepper"><button type="button" onClick={() => change(product.id, -1)} aria-label={`Diminuir ${product.name}`} disabled={data.paused}><Minus size={15} /></button><b>{quantities[product.id]}</b><button type="button" onClick={() => change(product.id, 1)} aria-label={`Aumentar ${product.name}`} disabled={data.paused || quantities[product.id] >= Math.min(20, product.stock ?? 20) || (product.category === "burger" && burgerCount >= 20)}><Plus size={15} /></button></div></div>
            <strong>{money(product.price * quantities[product.id])}</strong>
            {product.category === "burger" && <div className="burger-units">{Array.from({ length: quantities[product.id] }, (_, index) => <details className="burger-customization" key={index}>
              <summary>Hambúrguer {index + 1}{removals[product.id]?.[index]?.length ? ` · sem ${removals[product.id][index].join(", ").toLowerCase()}` : " · completo"}</summary>
              {product.ingredients.length ? <><p>Retire ingredientes desta unidade:</p>{product.ingredients.map(ingredient => <label key={ingredient}><input type="checkbox" checked={removals[product.id]?.[index]?.includes(ingredient) ?? false} onChange={() => toggleRemoval(product.id, index, ingredient)} disabled={data.paused} /> Sem {ingredient.toLowerCase()}</label>)}</> : <p>Sem ingredientes cadastrados para edição.</p>}
            </details>)}</div>}
          </div>) : <p className="checkout-empty">Seu carrinho está vazio. <Link href="/" onClick={() => window.sessionStorage.setItem("blueckyardigans-scroll-target", "hamburgueres")}>Escolha um hambúrguer</Link>.</p>}</div>
          <Link className="checkout-edit" href="/" onClick={() => window.sessionStorage.setItem("blueckyardigans-scroll-target", "cardapio")}>Adicionar mais itens do cardápio</Link><div className="checkout-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{method === "delivery" && <p className="checkout-fee">A taxa de entrega será informada antes do pagamento.</p>}{data.paid >= data.capacity && <div className="notice">A produção prevista foi atingida. Seu pedido depende de disponibilidade.</div>}{data.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-yellow checkout-submit" type="submit" form="checkout-form" disabled={busy || data.paused || burgerCount < 1}>{busy ? method === "pickup" ? "Preparando pagamento..." : "Criando pedido..." : method === "delivery" ? "Solicitar taxa de entrega" : "Criar pedido e continuar para o Pix"}<ArrowRight size={18} /></button><p className="checkout-submit-note">O número do pedido aparece na próxima tela.</p>
        </aside>
      </div>}
    </main>
  </div>;
}
