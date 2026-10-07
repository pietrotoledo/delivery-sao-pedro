"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import BrandAvatar from "./brand-avatar";
import { externalPhoto, productPhoto } from "@/lib/product-images";

type Product = { id: string; name: string; price: number; category: string; description: string; imageUrl: string | null };
type PublicData = { menu: Product[]; capacity: number; paid: number; paused: boolean; demo: boolean };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const groups = [
  { category: "burger", id: "hamburgueres", title: "Hambúrgueres", hint: "Escolha pelo menos um para pedir." },
  { category: "side", id: "acompanhamentos", title: "Para acompanhar", hint: "Uma porção para completar." },
  { category: "drink", id: "bebidas", title: "Bebidas", hint: "Adicione ao seu pedido." },
];
export default function Storefront() {
  const [data, setData] = useState<PublicData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/public")
      .then(response => {
        if (!response.ok) throw new Error("Cardápio indisponível");
        return response.json() as Promise<PublicData>;
      })
      .then(result => {
        setData(result);
        try {
          const saved = window.sessionStorage.getItem("blueckyardigans-cart");
          if (saved) setQuantities(JSON.parse(saved) as Record<string, number>);
        } catch { /* O cardápio continua disponível sem o carrinho salvo. */ }
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (data) window.sessionStorage.setItem("blueckyardigans-cart", JSON.stringify(quantities));
  }, [data, quantities]);

  const selected = useMemo(() => data?.menu.filter(product => (quantities[product.id] ?? 0) > 0) ?? [], [data, quantities]);
  const items = selected.map(product => ({ id: product.id, quantity: quantities[product.id] }));
  const burgerCount = selected.reduce((sum, product) => sum + (product.category === "burger" ? quantities[product.id] : 0), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const featured = data?.menu.find(product => product.id === "classic") ?? data?.menu.find(product => product.category === "burger");
  const checkoutHref = `/checkout?items=${encodeURIComponent(items.map(item => `${item.id}:${item.quantity}`).join(","))}`;

  function change(id: string, delta: number) {
    setQuantities(current => ({ ...current, [id]: Math.max(0, Math.min(20, (current[id] ?? 0) + delta)) }));
  }

  return <div className={`site-shell ${itemCount > 0 ? "has-desktop-cart" : ""}`}>
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
          <Image src={featured ? productPhoto(featured) : "/products/classic.webp"} unoptimized={featured ? externalPhoto(productPhoto(featured)) : false} fill priority sizes="(max-width: 800px) 100vw, 50vw" alt={featured ? featured.name : "Hambúrguer"} />
          {featured && <div className="hero-media-caption"><span>{featured.name}</span><strong>{money(featured.price)}</strong></div>}
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
            <div className={`product-art art-${product.id}`}><Image className="product-photo" src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} fill sizes={group.category === "drink" ? "(max-width: 700px) 50vw, 33vw" : "(max-width: 700px) 50vw, 50vw"} alt={`${product.name}, imagem ilustrativa`} /></div>
            <div className="product-info"><div className="product-title"><h4>{product.name}</h4><strong>{money(product.price)}</strong></div><p>{product.description}</p>
              <div className="quantity"><span>{quantities[product.id] ? "No pedido" : "Adicionar"}</span><div className="stepper"><button type="button" aria-label={`Diminuir ${product.name}`} disabled={!quantities[product.id] || data.paused} onClick={() => change(product.id, -1)}><Minus size={17} /></button><b aria-live="polite">{quantities[product.id] ?? 0}</b><button type="button" aria-label={`Aumentar ${product.name}`} disabled={data.paused || (quantities[product.id] ?? 0) >= 20 || (product.category === "burger" && burgerCount >= 20)} onClick={() => change(product.id, 1)}><Plus size={17} /></button></div></div>
            </div>
          </article>)}</div>
        </section>)}
        {data && <p className="photo-note">Fotos ilustrativas. Apresentação e porções podem variar no dia do evento.</p>}
      </section>
      <section className="order-section" id="pedido"><div className="wrap order-layout">
        <div className="order-intro"><p className="section-kicker">Seu pedido</p><h2>Escolheu?<br />Agora é só conferir.</h2><p>Na próxima tela você pode adicionar batata e bebida, escolher retirada ou entrega e informar seus dados.</p><div className="pickup-box"><MapPin size={22} /><div><b>Retirada na paróquia</b><span>Av. Maria Rosa, 1124 · Manaíra, João Pessoa<br />29 de outubro, das 18h às 22h</span></div></div></div>
        <div className="order-card">
          <div className="order-card-head"><h3>Resumo do carrinho</h3></div>
          <div className="cart-items">{selected.length ? selected.map(product => <div className="cart-line" key={product.id}><Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={48} height={48} alt="" /><span>{quantities[product.id]}× {product.name}</span><strong>{money(quantities[product.id] * product.price)}</strong></div>) : <p>Escolha um hambúrguer no cardápio para começar.</p>}</div>
          <div className="order-totals"><div><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span><strong>{money(subtotal)}</strong></div></div>
          {data?.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}
          {burgerCount > 0 && !data?.paused ? <Link className="button button-yellow submit-button" href={checkoutHref}>Ir para o checkout <ArrowRight size={19} /></Link> : <a className="button button-yellow submit-button" href="#hamburgueres">Escolher hambúrguer <ArrowRight size={19} /></a>}
          <p className="form-foot">Você confere tudo antes de criar o pedido.</p>
        </div>
      </div></section>
    </main>
    {itemCount > 0 && <div className="desktop-cart"><span className="desktop-cart-icon"><ShoppingBag size={22} /></span><span className="desktop-cart-total"><b>{itemCount} {itemCount === 1 ? "item" : "itens"} no pedido</b><strong>{money(subtotal)}</strong></span><Link className="button button-yellow" href={burgerCount > 0 ? checkoutHref : "#hamburgueres"} aria-label={burgerCount > 0 ? "Continuar para o checkout" : "Continuar escolhendo um hambúrguer"}>Continuar <ArrowRight size={18} /></Link></div>}
    {itemCount > 0 && <a className="mobile-cart" href={burgerCount > 0 ? checkoutHref : "#hamburgueres"} aria-label={burgerCount > 0 ? `Ver pedido com ${itemCount} itens, total ${money(subtotal)}` : "Escolha um hambúrguer para continuar"}><span>{burgerCount > 0 ? `${itemCount} ${itemCount === 1 ? "item" : "itens"} · ${money(subtotal)}` : "Escolha um hambúrguer"}</span><strong>{burgerCount > 0 ? "Continuar" : "Ver opções"} <ArrowRight size={18} /></strong></a>}
    <footer><div className="wrap footer-inner"><b>BLUECKYARDIGANS<span>®</span></b><p>Noite do Hambúrguer · 29 de outubro de 2026</p><a href="/admin">Acesso da equipe</a></div></footer>
  </div>;
}
