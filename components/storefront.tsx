"use client";
import { addMenuCombo, changeMenuQuantity, emptyMenuCart, restoreMenuCart, upgradeMenuBurger, type MenuProduct } from "@/lib/menu-cart";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import BrandAvatar from "./brand-avatar";
import StorefrontMenu from "./storefront-menu";
import DeliveryAreas from "./delivery-areas";
import NavigationLinks from "./navigation-links";
import { eventLocation } from "@/lib/event-location";
import { externalPhoto } from "@/lib/product-images";

type Product = MenuProduct;
type PublicData = { menu: Product[]; capacity: number; paid: number; paused: boolean; demo: boolean };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function Storefront() {
  const [data, setData] = useState<PublicData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState(emptyMenuCart);
  const { quantities } = cart;

  useEffect(() => {
    fetch("/api/public")
      .then(response => {
        if (!response.ok) throw new Error("Cardápio indisponível");
        return response.json() as Promise<PublicData>;
      })
      .then(result => {
        setData(result);
        try {
          const read = (key: string) => JSON.parse(window.sessionStorage.getItem(key) ?? "{}");
          setCart(restoreMenuCart(result.menu, read("blueckyardigans-cart"), read("blueckyardigans-combo-drinks"), read("blueckyardigans-removals")));
        } catch { /* O cardápio continua disponível sem o carrinho salvo. */ }
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      window.sessionStorage.setItem("blueckyardigans-cart", JSON.stringify(cart.quantities));
      window.sessionStorage.setItem("blueckyardigans-combo-drinks", JSON.stringify(cart.comboDrinks));
      window.sessionStorage.setItem("blueckyardigans-removals", JSON.stringify(cart.removals));
    }
    catch { /* O carrinho continua funcionando nesta página sem armazenamento. */ }
  }, [data, cart]);

  useEffect(() => {
    if (!data) return;
    let target: string | null = null;
    try {
      target = window.sessionStorage.getItem("blueckyardigans-scroll-target");
      if (target) window.sessionStorage.removeItem("blueckyardigans-scroll-target");
    } catch { return; }
    if (!target) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [data]);

  const selected = useMemo(() => data?.menu.filter(product => (quantities[product.id] ?? 0) > 0) ?? [], [data, quantities]);
  const items = selected.map(product => ({ id: product.id, quantity: quantities[product.id] }));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const checkoutHref = `/checkout?items=${encodeURIComponent(items.map(item => `${item.id}:${item.quantity}`).join(","))}`;

  function change(id: string, delta: number) {
    if (!data || data.paused) return;
    setCart(current => changeMenuQuantity(current, data.menu, id, delta));
  }

  function addCombo(id: string, drink: string) {
    if (!data || data.paused) return;
    setCart(current => addMenuCombo(current, data.menu, id, drink));
  }

  function upgrade(burgerId: string, comboId: string, drink: string) {
    if (!data || data.paused) return;
    setCart(current => upgradeMenuBurger(current, data.menu, burgerId, comboId, drink));
  }

  function scrollTo(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return <div className={`site-shell ${itemCount > 0 ? "has-desktop-cart" : ""}`}>
    <header className="topbar wrap">
      <Link className="brand" href="/" aria-label="BLUECKYARDIGANS, início"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link>
      <nav className="toplinks" aria-label="Navegação"><Link href="/" onClick={event => scrollTo(event, "cardapio")}>Cardápio</Link><Link href="/" onClick={event => scrollTo(event, "pedido")}>Meu pedido</Link></nav>
      <Link className="nav-cta" href="/" onClick={event => scrollTo(event, itemCount ? "pedido" : "cardapio")}>{itemCount ? `Ver pedido · ${money(subtotal)}` : "Ver cardápio"}<ArrowRight size={17} /></Link>
    </header>
    <main>
      <section className="hero"><div className="hero-inner wrap">
        <div className="hero-copy hero-flow">
        <div className="hero-heading">
          <div className="event-chip"><span className="event-dot" /> Noite do Hambúrguer · 30 de outubro</div>
          <h1>O sabor da<br />nossa <em>gincana.</em></h1>
        </div>
          <p>Hambúrguer feito para reunir todo mundo. Escolha o seu, adicione os acompanhamentos e garanta o pedido para a noite.</p>
        <Link className="hero-media hero-combo" href="/#cardapio" onClick={event => scrollTo(event, "cardapio")} aria-label="Ver o combo da noite no cardápio">
          <div className="hero-combo-photo"><Image src="/products/combo-azul-v2.webp" fill priority sizes="(max-width: 800px) 100vw, 50vw" alt="Combo com hambúrguer artesanal, batata frita e bebida" /></div>
          <div className="hero-combo-caption"><span><strong>Combo da noite</strong><small>Hambúrguer + batata + bebida</small></span><span className="hero-combo-action">Ver cardápio <ArrowRight size={18} aria-hidden="true" /></span></div>
        </Link>

          <div className="event-schedule"><strong>30 de outubro</strong><span>Entregas começam às 18h</span></div>
          <div className="hero-actions"><Link className="button button-yellow" href="/" onClick={event => scrollTo(event, "hamburgueres")}>Escolher meu hambúrguer <ArrowRight size={19} /></Link></div>
          <div className="event-location" id="localizacao"><MapPin size={24} aria-hidden="true" /><div><strong>{eventLocation.name}</strong><address>{eventLocation.address}</address><span>30 de outubro · Retirada das 18h às 22h</span><NavigationLinks destination={eventLocation.address} dark /></div></div>
        </div>
      </div></section>
      <div className="service-strip"><div className="wrap service-strip-inner"><span>30 de outubro</span><span>Entregas a partir das 18h</span><span>Retirada no {eventLocation.name} · 18h às 22h</span></div></div>
      <div className="wrap storefront-delivery" id="delivery"><DeliveryAreas /></div>
      <section className="menu-section wrap" id="cardapio">
        <div className="section-head"><div><p className="section-kicker">Cardápio da noite</p><h2>Escolha seu pedido.</h2></div><p>Combo completo ou só o hambúrguer. Depois, acrescente o que quiser.</p></div>
        {!data && !loadError && <p className="menu-feedback" role="status">Carregando cardápio...</p>}
        {loadError && <p className="menu-feedback" role="alert">Não foi possível carregar o cardápio. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></p>}
        {data?.paused && <div className="notice">Os pedidos estão pausados no momento. Volte mais tarde para comprar.</div>}
        {data && <StorefrontMenu products={data.menu} cart={cart} paused={data.paused} onChange={change} onAddCombo={addCombo} onUpgrade={upgrade} />}
      </section>
      <section className="order-section" id="pedido"><div className="wrap order-layout">
        <div className="order-intro"><p className="section-kicker">Seu pedido</p><h2>Escolheu?<br />Agora é só conferir.</h2><p>Na próxima tela você pode adicionar batata e bebida, escolher retirada ou entrega e informar seus dados. As entregas começam em 30 de outubro, às 18h.</p><div className="pickup-box"><MapPin size={22} /><div><b>Retirada no {eventLocation.name}</b><span>{eventLocation.address}<br />30 de outubro, das 18h às 22h</span><NavigationLinks destination={eventLocation.address} /></div></div></div>
        <div className="order-card">
          <div className="order-card-head"><h3>Resumo do carrinho</h3></div>
          <div className="cart-items">{selected.length ? selected.map(product => <div className="cart-line" key={product.id}>{product.imageUrl && <Image src={product.imageUrl} unoptimized={externalPhoto(product.imageUrl)} width={48} height={48} alt="" />}<span>{quantities[product.id]}× {product.name}{product.category === "combo" && <small className="cart-combo-drinks">{cart.comboDrinks[product.id]?.filter(Boolean).join(", ")}</small>}</span><strong>{money(quantities[product.id] * product.price)}</strong></div>) : <p>Escolha um hambúrguer no cardápio para começar.</p>}</div>
          <div className="order-totals"><div><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span><strong>{money(subtotal)}</strong></div></div>
          {data?.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}
          {itemCount > 0 && !data?.paused ? <a className="button button-yellow submit-button" href={checkoutHref}>Ir para o checkout <ArrowRight size={19} /></a> : <Link className="button button-yellow submit-button" href="/" onClick={event => scrollTo(event, "hamburgueres")}>Ver cardápio <ArrowRight size={19} /></Link>}
          <p className="form-foot">Você confere tudo antes de criar o pedido.</p>
        </div>
      </div></section>
    </main>
    {itemCount > 0 && <div className="desktop-cart"><span className="desktop-cart-icon"><ShoppingBag size={22} /></span><span className="desktop-cart-total"><b>{itemCount} {itemCount === 1 ? "item" : "itens"} no pedido</b><strong>{money(subtotal)}</strong></span>{itemCount > 0 ? <a className="button button-yellow" href={checkoutHref} aria-label="Continuar para o checkout">Continuar <ArrowRight size={18} /></a> : <Link className="button button-yellow" href="/" onClick={event => scrollTo(event, "hamburgueres")} aria-label="Continuar escolhendo um hambúrguer">Continuar <ArrowRight size={18} /></Link>}</div>}
    {itemCount > 0 && (itemCount > 0 ? <a className="mobile-cart" href={checkoutHref} aria-label={`Ver pedido com ${itemCount} itens, total ${money(subtotal)}`}><span>{itemCount} {itemCount === 1 ? "item" : "itens"} · {money(subtotal)}</span><strong>Continuar <ArrowRight size={18} /></strong></a> : <Link className="mobile-cart" href="/" onClick={event => scrollTo(event, "hamburgueres")} aria-label="Escolha um hambúrguer para continuar"><span>Escolha um hambúrguer</span><strong>Ver opções <ArrowRight size={18} /></strong></Link>)}
    <footer><div className="wrap footer-inner"><b>BLUECKYARDIGANS<span>®</span></b><p>Noite do Hambúrguer · 30 de outubro de 2026</p></div></footer>
  </div>;
}
