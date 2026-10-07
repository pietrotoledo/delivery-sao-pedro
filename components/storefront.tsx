"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, MapPin, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BrandAvatar from "./brand-avatar";

type Product = { id: string; name: string; price: number; category: string; description: string };
type PublicData = { menu: Product[]; capacity: number; paid: number; paused: boolean; demo: boolean };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const groups = [
  { category: "burger", id: "hamburgueres", title: "Hambúrgueres", hint: "Escolha pelo menos um para pedir." },
  { category: "side", id: "acompanhamentos", title: "Para acompanhar", hint: "Uma porção para completar." },
  { category: "drink", id: "bebidas", title: "Bebidas", hint: "Adicione ao seu pedido." },
];
const photos: Record<string, string> = {
  classic: "/products/classic.webp",
  bacon: "/products/bacon.webp",
  "fries-small": "/products/fries-small.webp",
  "fries-large": "/products/fries-large.webp",
  water: "/products/water.webp",
  coke: "/products/cola.webp",
  "coke-zero": "/products/cola.webp",
};

export default function Storefront() {
  const router = useRouter();
  const [data, setData] = useState<PublicData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [neighborhood, setNeighborhood] = useState("Manaíra");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public")
      .then(response => {
        if (!response.ok) throw new Error("Cardápio indisponível");
        return response.json() as Promise<PublicData>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  const selected = useMemo(() => data?.menu.filter(product => (quantities[product.id] ?? 0) > 0) ?? [], [data, quantities]);
  const items = selected.map(product => ({ id: product.id, quantity: quantities[product.id] }));
  const burgerCount = selected.reduce((sum, product) => sum + (product.category === "burger" ? quantities[product.id] : 0), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);

  function change(id: string, delta: number) {
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(20, (current[id] ?? 0) + delta)) }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (burgerCount < 1) {
      setError("Escolha pelo menos um hambúrguer para continuar.");
      document.getElementById("hamburgueres")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, method, neighborhood, address, notes, items }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Não foi possível criar o pedido.");
      router.push(`/pedido/${result.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível criar o pedido.");
      setBusy(false);
    }
  }

  return <div className="site-shell">
    <header className="topbar wrap">
      <Link className="brand" href="/" aria-label="BLUECKYARDIGANS, início"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link>
      <nav className="toplinks" aria-label="Navegação"><a href="#cardapio">Cardápio</a><a href="#pedido">Meu pedido</a></nav>
      <a className="nav-cta" href={itemCount ? "#pedido" : "#cardapio"}>{itemCount ? `Ver pedido · ${money(subtotal)}` : "Ver cardápio"}<ArrowRight size={17} /></a>
    </header>
    <main>
      <section className="hero"><div className="hero-inner wrap">
        <div className="hero-copy">
          <div className="event-chip"><span className="event-dot" /> Noite do Hambúrguer · 29 de outubro</div>
          <h1>O sabor da<br />nossa <em>gincana.</em></h1>
          <p>Hambúrguer feito para reunir todo mundo. Escolha o seu, adicione os acompanhamentos e garanta o pedido para a noite.</p>
          <div className="hero-actions"><a className="button button-yellow" href="#hamburgueres">Escolher meu hambúrguer <ArrowRight size={19} /></a></div>
          <div className="hero-facts"><span><MapPin size={17} /> Paróquia São Pedro Pescador</span><span>18h às 22h · retirada ou entrega</span></div>
        </div>
        <div className="hero-media">
          <Image src="/products/classic.webp" fill priority sizes="(max-width: 800px) 100vw, 50vw" alt="Hambúrguer Clássico com queijo, alface e tomate" />
          <div className="hero-media-caption"><span>Comece pelo clássico</span><strong>R$ 22,00</strong></div>
          <div className="hero-mascot"><Image src="/mascote.png" width={112} height={112} alt="Mascote Blueckyardigans" /></div>
        </div>
      </div></section>
      <div className="service-strip"><div className="wrap service-strip-inner"><span>Escolha sem complicação</span><span>Retire na paróquia ou receba em casa</span><span>Pagamento por Pix</span></div></div>
      <section className="menu-section wrap" id="cardapio">
        <div className="section-head"><div><p className="section-kicker">Cardápio da noite</p><h2>O que vai no seu pedido?</h2></div><p>Escolha os itens e veja o total na hora. É rápido.</p></div>
        {!data && !loadError && <p className="menu-feedback" role="status">Carregando cardápio...</p>}
        {loadError && <p className="menu-feedback" role="alert">Não foi possível carregar o cardápio. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></p>}
        {data?.paused && <div className="notice">Os pedidos estão pausados no momento. Volte mais tarde para comprar.</div>}
        {data && groups.map(group => <section className="menu-group" id={group.id} key={group.category}>
          <div className="menu-group-head"><h3>{group.title}</h3><p>{group.hint}</p></div>
          <div className="menu-grid">{data.menu.filter(product => product.category === group.category).map(product => <article className={`product-card ${quantities[product.id] ? "is-selected" : ""}`} key={product.id}>
            <div className={`product-art art-${product.id}`}><Image className="product-photo" src={photos[product.id]} fill sizes={group.category === "drink" ? "(max-width: 700px) 50vw, 33vw" : "(max-width: 700px) 50vw, 50vw"} alt={product.category === "drink" && product.id !== "water" ? "Refrigerante gelado em copo, imagem ilustrativa" : `${product.name}, imagem ilustrativa`} /></div>
            <div className="product-info"><div className="product-title"><h4>{product.name}</h4><strong>{money(product.price)}</strong></div><p>{product.description}</p>
              <div className="quantity"><span>{quantities[product.id] ? "No pedido" : "Adicionar"}</span><div className="stepper"><button type="button" aria-label={`Diminuir ${product.name}`} disabled={!quantities[product.id] || data.paused} onClick={() => change(product.id, -1)}><Minus size={17} /></button><b aria-live="polite">{quantities[product.id] ?? 0}</b><button type="button" aria-label={`Aumentar ${product.name}`} disabled={data.paused || (quantities[product.id] ?? 0) >= 20 || (product.category === "burger" && burgerCount >= 20)} onClick={() => change(product.id, 1)}><Plus size={17} /></button></div></div>
            </div>
          </article>)}</div>
        </section>)}
        {data && <p className="photo-note">Fotos ilustrativas. Apresentação e porções podem variar no dia do evento.</p>}
      </section>
      <section className="order-section" id="pedido"><div className="wrap order-layout">
        <div className="order-intro"><p className="section-kicker">Seu pedido</p><h2>Falta pouco<br />para comer.</h2><p>Confira os itens e escolha como vai receber. Para entrega, você vê a taxa antes de pagar.</p><div className="pickup-box"><MapPin size={22} /><div><b>Retirada na paróquia</b><span>Av. Maria Rosa, 1124 · Manaíra, João Pessoa<br />29 de outubro, das 18h às 22h</span></div></div></div>
        <form className="order-card" onSubmit={submit}>
          <div className="order-card-head"><ShoppingBag size={23} /><h3>Finalizar pedido</h3></div>
          <div className="cart-items">{selected.length ? selected.map(product => <div className="cart-line" key={product.id}><Image src={photos[product.id]} width={48} height={48} alt="" /><span>{quantities[product.id]}× {product.name}</span><strong>{money(quantities[product.id] * product.price)}</strong></div>) : <p>Escolha um hambúrguer no cardápio para começar.</p>}</div>
          <a className="edit-order" href="#cardapio">{selected.length ? "Editar itens" : "Ver cardápio"}</a>
          <h4 className="form-step-title">Como quer receber?</h4>
          <div className="method-options"><button type="button" className={method === "pickup" ? "selected" : ""} aria-pressed={method === "pickup"} onClick={() => setMethod("pickup")}><MapPin size={20} /><span>Vou retirar<small>Na paróquia</small></span>{method === "pickup" && <Check size={17} />}</button><button type="button" className={method === "delivery" ? "selected" : ""} aria-pressed={method === "delivery"} onClick={() => setMethod("delivery")}><Truck size={20} /><span>Quero entrega<small>Taxa antes do Pix</small></span>{method === "delivery" && <Check size={17} />}</button></div>
          <h4 className="form-step-title">Seus dados</h4>
          <div className="fields"><label>Nome<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Seu nome" required minLength={2} /></label><label>WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="(83) 99999-9999" required /></label>
            {method === "delivery" && <><label>Bairro<select value={neighborhood} onChange={event => setNeighborhood(event.target.value)}><option>Manaíra</option><option>Bessa</option><option>Tambaú</option></select></label><label>Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} autoComplete="street-address" placeholder="Rua, número, complemento e referência" required minLength={8} /></label></>}
          </div>
          <details className="notes-details"><summary>Adicionar observação <span>opcional</span></summary><label htmlFor="order-notes">Observações do pedido</label><textarea id="order-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Alguma informação para a equipe?" rows={2} maxLength={300} /></details>
          <div className="order-totals"><div><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span><strong>{money(subtotal)}</strong></div>{method === "delivery" && <p>Taxa de entrega informada antes do pagamento.</p>}</div>
          {data && data.paid >= data.capacity && <div className="notice">A produção prevista foi atingida. Seu pedido depende de disponibilidade; se não for atendido, o pagamento será devolvido.</div>}
          {data?.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-yellow submit-button" type="submit" disabled={busy || data?.paused || !data}>{busy ? "Criando pedido..." : method === "delivery" ? "Solicitar taxa de entrega" : "Continuar para o Pix"}<ArrowRight size={19} /></button>
          <p className="form-foot">Pagamento por Pix · evento em 29/10/2026</p>
        </form>
      </div></section>
    </main>
    {itemCount > 0 && <a className="mobile-cart" href={burgerCount > 0 ? "#pedido" : "#hamburgueres"} aria-label={burgerCount > 0 ? `Ver pedido com ${itemCount} itens, total ${money(subtotal)}` : "Escolha um hambúrguer para continuar"}><span>{burgerCount > 0 ? `${itemCount} ${itemCount === 1 ? "item" : "itens"} · ${money(subtotal)}` : "Escolha um hambúrguer"}</span><strong>{burgerCount > 0 ? "Continuar" : "Ver opções"} <ArrowRight size={18} /></strong></a>}
    <footer><div className="wrap footer-inner"><b>BLUECKYARDIGANS<span>®</span></b><p>Noite do Hambúrguer · 29 de outubro de 2026</p><a href="/admin">Acesso da equipe</a></div></footer>
  </div>;
}
