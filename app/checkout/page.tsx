"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import BrandAvatar from "@/components/brand-avatar";

type Product = { id: string; name: string; price: number; category: string; description: string };
type PublicData = { menu: Product[]; capacity: number; paid: number; paused: boolean };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const photos: Record<string, string> = {
  classic: "/products/classic.webp", bacon: "/products/bacon.webp",
  "fries-small": "/products/fries-small.webp", "fries-large": "/products/fries-large.webp",
  water: "/products/water.webp", coke: "/products/cola.webp", "coke-zero": "/products/cola.webp",
};

export default function CheckoutPage() {
  const router = useRouter();
  const [data, setData] = useState<PublicData | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const initial: Record<string, number> = {};
    for (const entry of (params.get("items") || "").split(",")) {
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
  const [neighborhood, setNeighborhood] = useState("Manaíra");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public")
      .then(response => { if (!response.ok) throw new Error("Cardápio indisponível"); return response.json() as Promise<PublicData>; })
      .then(setData)
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
    window.sessionStorage.setItem("blueckyardigans-cart", JSON.stringify(quantities));
  }, [quantities, data]);

  function change(id: string, delta: number) {
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(20, (current[id] ?? 0) + delta)) }));
  }

  function upgradeFries() {
    setQuantities(current => ({ ...current, "fries-small": Math.max(0, (current["fries-small"] ?? 0) - 1), "fries-large": Math.min(20, (current["fries-large"] ?? 0) + 1) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!data || burgerCount < 1) { setError("Adicione pelo menos um hambúrguer antes de continuar."); return; }
    setBusy(true);
    try {
      const items = selected.map(product => ({ id: product.id, quantity: quantities[product.id] }));
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, method, neighborhood, address, notes, items }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Não foi possível criar o pedido.");
      window.sessionStorage.removeItem("blueckyardigans-cart");
      router.push(`/pedido/${result.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível criar o pedido.");
      setBusy(false);
    }
  }

  const noFries = !(quantities["fries-small"] || quantities["fries-large"]);
  const noDrink = !(quantities.water || quantities.coke || quantities["coke-zero"]);
  const showSuggestions = burgerCount > 0 && (noFries || noDrink || Boolean(quantities["fries-small"]));

  return <div className="checkout-page">
    <header className="topbar wrap checkout-topbar"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><Link className="checkout-back" href="/#cardapio"><ArrowLeft size={17} /> Voltar ao cardápio</Link></header>
    <main className="checkout-main wrap">
      <div className="checkout-heading"><span className="checkout-step">Cardápio <span>›</span> Checkout <span>›</span> Acompanhar pedido</span><h1>Confira e finalize seu pedido.</h1><p>Adicione o que faltar, informe seus dados e veja o total antes de seguir para o Pix.</p></div>
      {loadError && <div className="checkout-alert" role="alert">Não foi possível carregar o cardápio. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>}
      {!data && !loadError && <p role="status">Carregando checkout...</p>}
      {data && <div className="checkout-grid">
        <div className="checkout-flow">
          {showSuggestions && <section className="checkout-panel checkout-suggestions" aria-labelledby="suggestions-title"><div className="checkout-panel-heading"><span className="checkout-panel-number">01</span><div><h2 id="suggestions-title">Complete seu pedido</h2><p>Sugestões para acompanhar seu hambúrguer. Você decide.</p></div></div><div className="suggestion-grid">
            {noFries && (burgerCount > 1 ? ["fries-large", "fries-small"] : ["fries-small", "fries-large"]).map(id => { const product = getProduct(id); return product && <div className="suggestion" key={id}><Image src={photos[id]} width={76} height={76} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)}</span></div><button type="button" onClick={() => change(id, 1)} disabled={data.paused} aria-label={`Adicionar ${product.name}`}><Plus size={17} /> Adicionar</button></div>; })}
            {Boolean(quantities["fries-small"]) && <div className="suggestion"><Image src={photos["fries-large"]} width={76} height={76} alt="" /><div><strong>Prefere batata grande?</strong><span>Troque uma pequena por +{money(friesUpgradePrice)}</span></div><button type="button" onClick={upgradeFries} disabled={data.paused || (quantities["fries-large"] ?? 0) >= 20}><ArrowRight size={17} /> Trocar</button></div>}
            {noDrink && ["coke", "coke-zero"].map(id => { const product = getProduct(id); return product && <div className="suggestion" key={id}><Image src={photos[id]} width={76} height={76} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)}</span></div><button type="button" onClick={() => change(id, 1)} disabled={data.paused} aria-label={`Adicionar ${product.name}`}><Plus size={17} /> Adicionar</button></div>; })}
          </div></section>}
          <form id="checkout-form" onSubmit={submit}>
            <section className="checkout-panel"><div className="checkout-panel-heading"><span className="checkout-panel-number">{showSuggestions ? "02" : "01"}</span><div><h2>Como vai receber?</h2><p>Escolha a opção mais conveniente.</p></div></div><div className="method-options"><button type="button" className={method === "pickup" ? "selected" : ""} aria-pressed={method === "pickup"} onClick={() => setMethod("pickup")}><MapPin size={20} /><span>Vou retirar<small>Paróquia São Pedro Pescador</small></span>{method === "pickup" && <Check size={17} />}</button><button type="button" className={method === "delivery" ? "selected" : ""} aria-pressed={method === "delivery"} onClick={() => setMethod("delivery")}><Truck size={20} /><span>Quero entrega<small>Taxa informada antes do Pix</small></span>{method === "delivery" && <Check size={17} />}</button></div>{method === "pickup" && <p className="checkout-help">Av. Maria Rosa, 1124 · Manaíra · 29 de outubro, das 18h às 22h.</p>}</section>
            <section className="checkout-panel"><div className="checkout-panel-heading"><span className="checkout-panel-number">{showSuggestions ? "03" : "02"}</span><div><h2>Seus dados</h2><p>Usaremos estes dados para identificar seu pedido.</p></div></div><div className="fields"><label>Nome completo<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Seu nome" required minLength={2} maxLength={100} /></label><label>WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="(83) 99999-9999" required minLength={10} /></label><label>E-mail<input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} /></label>{method === "delivery" && <><label>Bairro<select value={neighborhood} onChange={event => setNeighborhood(event.target.value)}><option>Manaíra</option><option>Bessa</option><option>Tambaú</option></select></label><label>Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} autoComplete="street-address" placeholder="Rua, número, complemento e referência" required minLength={8} maxLength={220} /></label></>}</div><details className="notes-details"><summary>Adicionar observação <span>opcional</span></summary><label htmlFor="checkout-notes">Observações do pedido</label><textarea id="checkout-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Alguma informação para a equipe?" rows={2} maxLength={300} /></details></section>
          </form>
        </div>
        <aside className="checkout-summary checkout-panel" aria-label="Resumo do pedido"><div className="checkout-panel-heading"><ShoppingBag size={23} /><div><h2>Seu pedido</h2><p>{itemCount} {itemCount === 1 ? "item" : "itens"}</p></div></div><div className="checkout-lines">{selected.length ? selected.map(product => <div className="checkout-line" key={product.id}><Image src={photos[product.id]} width={60} height={60} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)} cada</span><div className="checkout-stepper"><button type="button" onClick={() => change(product.id, -1)} aria-label={`Diminuir ${product.name}`} disabled={data.paused}><Minus size={15} /></button><b>{quantities[product.id]}</b><button type="button" onClick={() => change(product.id, 1)} aria-label={`Aumentar ${product.name}`} disabled={data.paused || quantities[product.id] >= 20 || (product.category === "burger" && burgerCount >= 20)}><Plus size={15} /></button></div></div><strong>{money(product.price * quantities[product.id])}</strong></div>) : <p className="checkout-empty">Seu carrinho está vazio. <Link href="/#hamburgueres">Escolha um hambúrguer</Link>.</p>}</div><Link className="checkout-edit" href="/#cardapio">Adicionar mais itens do cardápio</Link><div className="checkout-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{method === "delivery" && <p className="checkout-fee">A taxa de entrega será informada antes do pagamento.</p>}{data.paid >= data.capacity && <div className="notice">A produção prevista foi atingida. Seu pedido depende de disponibilidade.</div>}{data.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-yellow checkout-submit" type="submit" form="checkout-form" disabled={busy || data.paused || burgerCount < 1}>{busy ? "Criando pedido..." : method === "delivery" ? "Solicitar taxa de entrega" : "Criar pedido e continuar para o Pix"}<ArrowRight size={18} /></button><p className="checkout-submit-note">O número do pedido aparece na próxima tela.</p></aside>
      </div>}
    </main>
  </div>;
}
