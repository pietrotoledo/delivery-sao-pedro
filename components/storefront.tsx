"use client";
import { addMenuCombo, changeMenuQuantity, emptyMenuCart, menuBurgerCount, restoreMenuCart, upgradeMenuBurger, type MenuProduct } from "@/lib/menu-cart";
import { includesBurger } from "@/lib/menu-options";
import { BurgerRequirementNotice, focusBurgerRequirement, LastBurgerDialog } from "./burger-requirement";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import BrandAvatar from "./brand-avatar";
import StorefrontMenu from "./storefront-menu";
import DeliveryAreas from "./delivery-areas";
import NavigationLinks from "./navigation-links";
import { eventLocation } from "@/lib/event-location";
import { eventDayText } from "@/lib/event-schedule";
import { externalPhoto } from "@/lib/product-images";
import { eventSalesPaused } from "@/lib/event-announcement";
import EventPause from "./event-pause";
import { BackyardFence, BackyardHouses, Bunting, FooterSea, NightSky, PabloTracks } from "./backyard-art";

type Product = MenuProduct;
type PublicData = { menu: Product[]; capacity: number; paid: number; burgersLeft?: number; paused: boolean; demo: boolean; currentDay?: string };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function Storefront() {
  const [data, setData] = useState<PublicData | null>(null);
  // A data vem do dia de vendas aberto no painel; até carregar, mostra a primeira noite.
  const eventDay = eventDayText(data?.currentDay);
  const [loadError, setLoadError] = useState(false);
  const [cart, setCart] = useState(emptyMenuCart);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [removedLastBurger, setRemovedLastBurger] = useState(false);
  const { quantities } = cart;

  useEffect(() => {
    if (eventSalesPaused) return;
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
  const burgerCount = menuBurgerCount(cart, data?.menu ?? []);
  const subtotal = selected.reduce((sum, product) => sum + product.price * quantities[product.id], 0);
  const checkoutHref = `/checkout?items=${encodeURIComponent(items.map(item => `${item.id}:${item.quantity}`).join(","))}`;

  function change(id: string, delta: number) {
    if (!data || data.paused) return;
    const product = data.menu.find(item => item.id === id);
    if (delta < 0 && product && includesBurger(product) && quantities[id] === 1 && burgerCount === 1) {
      setPendingRemoval(id);
      return;
    }
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

  if (eventSalesPaused) return <EventPause />;

  return <div className={`site-shell ${itemCount > 0 ? "has-desktop-cart" : ""}`}>
    {pendingRemoval && <LastBurgerDialog onCancel={() => setPendingRemoval(null)} onConfirm={() => {
      if (data && !data.paused) setCart(current => changeMenuQuantity(current, data.menu, pendingRemoval, -1));
      setRemovedLastBurger(true);
      setPendingRemoval(null);
      focusBurgerRequirement();
    }} />}
    <header className="site-header"><div className="topbar wrap">
      <Link className="brand" href="/" aria-label="BLUECKYARDIGANS, início"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link>
      <nav className="toplinks" aria-label="Navegação"><Link href="/" onClick={event => scrollTo(event, "cardapio")}>Cardápio</Link><Link href="/" onClick={event => scrollTo(event, "pedido")}>Meu pedido</Link></nav>
      <Link className="nav-cta" href="/" onClick={event => scrollTo(event, itemCount ? "pedido" : "cardapio")}>{itemCount ? `Ver pedido · ${money(subtotal)}` : "Ver cardápio"}<ArrowRight size={17} /></Link>
    </div></header>
    <main>
      <section className="hero hero-backyard"><NightSky /><Bunting /><BackyardHouses /><div className="hero-inner wrap">
        <div className="hero-copy hero-flow">
        <div className="hero-heading">
          <h1>Noite do{" "}<br />Hambúrguer</h1>
          <p className="hero-cause">Toda a renda vai para a compra de alimentos para instituições carentes.</p>
        </div>
          <p>Escolha o seu hambúrguer, adicione os acompanhamentos e garanta o pedido para a noite.</p>
        <Link className="hero-media hero-combo" href="/#cardapio" onClick={event => scrollTo(event, "cardapio")} aria-label="Ver o combo da noite no cardápio">
          <div className="hero-combo-photo"><Image src="/products/combo-azul-v2.webp" fill priority sizes="(max-width: 800px) 100vw, 50vw" alt="Combo com hambúrguer artesanal, batata frita e bebida" /></div>
          <div className="hero-combo-caption"><span><strong>Blueck Combo</strong><small>Hambúrguer + batata + bebida</small></span><span className="hero-combo-action">Ver cardápio <ArrowRight size={18} aria-hidden="true" /></span></div>
        </Link>

          <div className="event-schedule"><strong>{eventDay.short}</strong><span>Entregas começam às 19h</span></div>
          <div className="hero-actions"><Link className="button button-yellow" href="/" onClick={event => scrollTo(event, "hamburgueres")}>Escolher meu hambúrguer <ArrowRight size={19} /></Link></div>
          <div className="event-location" id="localizacao"><MapPin size={24} aria-hidden="true" /><div><strong>{eventLocation.name}</strong><address>{eventLocation.address}</address><span>{eventDay.short} · Retirada das 18h às 22h</span><NavigationLinks destination={eventLocation.address} dark /></div></div>
        </div>
      </div><BackyardFence /></section>
      <div className="service-strip"><div className="wrap service-strip-inner"><span className="service-strip-free">Frete grátis acima de R$ 60 para todos os bairros</span><span>{eventDay.short}</span><span>Entregas a partir das 19h</span><span>Retirada no {eventLocation.name} · 18h às 22h</span></div></div>
      <section className="cause wrap" id="causa" aria-label="Para onde vai a renda">
        <p className="cause-strip"><Image className="cause-pablo" src="/pablo/pablo-correndo.webp" width={569} height={700} sizes="48px" alt="" /><span><strong>Cada pedido pago vira alimento.</strong> Toda a renda vai para instituições carentes · organização do EJC da Igreja São Pedro Pescador.</span></p>
      </section>
      <div className="wrap storefront-delivery" id="delivery"><DeliveryAreas /></div>
      <section className="menu-section wrap" id="cardapio">
        <PabloTracks /><div className="section-head"><div><p className="section-kicker">Cardápio da noite</p><h2>Escolha seu pedido.</h2></div><p>Combo completo ou só o hambúrguer. Depois, acrescente o que quiser.</p></div>
        {!data && !loadError && <p className="menu-feedback" role="status"><span className="propeller-loader" aria-hidden="true"><i /></span>Carregando cardápio...</p>}
        {loadError && <p className="menu-feedback" role="alert">Não foi possível carregar o cardápio. <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></p>}
        {data?.paused && <div className="notice">Os pedidos estão pausados no momento. Volte mais tarde para comprar.</div>}{!data?.paused && data?.burgersLeft === 0 && <div className="notice">Os hambúrgueres esgotaram. Obrigado pelo interesse!</div>}
        {data && <StorefrontMenu products={data.menu} cart={cart} paused={data.paused} onChange={change} onAddCombo={addCombo} onUpgrade={upgrade} />}
      </section>
      <section className="order-section" id="pedido"><div className="wrap order-layout">
        <div className="order-intro"><Image className="order-pablo" src="/pablo/pablo-correndo.webp" width={569} height={700} sizes="120px" alt="" /><p className="section-kicker">Seu pedido</p><h2>Escolheu?<br />Agora é só conferir.</h2><p>Na próxima tela você pode adicionar acompanhamentos, bebidas e docinhos, escolher retirada ou entrega e informar seus dados. As entregas começam em {eventDay.short}, às 19h.</p><div className="pickup-box"><MapPin size={22} /><div><b>Retirada no {eventLocation.name}</b><span>{eventLocation.address}<br />{eventDay.short}, das 18h às 22h</span><NavigationLinks destination={eventLocation.address} /></div></div></div>
        <div className="order-card">
          <div className="order-card-head"><h3>Resumo do carrinho</h3></div>
          <div className="cart-items">{selected.length ? selected.map(product => <div className="cart-line" key={product.id}>{product.imageUrl && <Image src={product.imageUrl} unoptimized={externalPhoto(product.imageUrl)} width={48} height={48} alt="" />}<span>{quantities[product.id]}× {product.name}{product.category === "combo" && <small className="cart-combo-drinks">{cart.comboDrinks[product.id]?.filter(Boolean).join(", ")}</small>}</span><strong>{money(quantities[product.id] * product.price)}</strong></div>) : <p className="cart-empty"><Image src="/pablo/pablo-esperando.webp" width={168} height={264} sizes="56px" alt="" />Escolha um hambúrguer no cardápio para começar. O Pablo está esperando!</p>}</div>
          <div className="order-totals"><div><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span><strong>{money(subtotal)}</strong></div></div>
          {burgerCount === 0 && (itemCount > 0 || removedLastBurger) && <BurgerRequirementNotice href="#hamburgueres" onChoose={event => scrollTo(event, "hamburgueres")} />}
          {data?.paused && <div className="notice">Os pedidos estão pausados no momento.</div>}
          {burgerCount > 0 && !data?.paused ? <a className="button button-yellow submit-button" href={checkoutHref}>Ir para o checkout <ArrowRight size={19} /></a> : <Link className="button button-yellow submit-button" href="/" onClick={event => scrollTo(event, "hamburgueres")}>{itemCount > 0 ? "Adicionar hambúrguer" : "Ver cardápio"} <ArrowRight size={19} /></Link>}
          <p className="form-foot">Você confere tudo antes de criar o pedido.</p>
          <p className="cause-note">Toda a renda vai para a compra de alimentos para instituições carentes.</p>
        </div>
      </div></section>
    </main>
    {itemCount > 0 && <div className="desktop-cart"><span className="desktop-cart-icon" key={itemCount}><ShoppingBag size={22} /></span><span className="desktop-cart-total"><b>{itemCount} {itemCount === 1 ? "item" : "itens"} no pedido</b><strong>{money(subtotal)}</strong></span>{burgerCount > 0 ? <a className="button button-yellow" href={checkoutHref} aria-label="Continuar para o checkout">Continuar <ArrowRight size={18} /></a> : <Link className="button button-yellow" href="/" onClick={event => scrollTo(event, "hamburgueres")} aria-label="Continuar escolhendo um hambúrguer">Continuar <ArrowRight size={18} /></Link>}</div>}
    {itemCount > 0 && (burgerCount > 0 ? <a className="mobile-cart" href={checkoutHref} aria-label={`Ver pedido com ${itemCount} itens, total ${money(subtotal)}`}><span className="mobile-cart-count" key={itemCount}>{itemCount} {itemCount === 1 ? "item" : "itens"} · {money(subtotal)}</span><strong>Continuar <ArrowRight size={18} /></strong></a> : <Link className="mobile-cart" href="/" onClick={event => scrollTo(event, "hamburgueres")} aria-label="Escolha um hambúrguer para continuar"><span>Escolha um hambúrguer</span><strong>Ver opções <ArrowRight size={18} /></strong></Link>)}
    <footer className="footer-party"><FooterSea /><Bunting /><div className="wrap footer-inner"><div className="footer-title"><small>BLUECKYARDIGANS apresenta</small><span className="footer-title-row"><BrandAvatar /><b>Gincana <em>São Pedro</em> Pescador <span className="footer-year">2026</span></b></span></div><p>Noite do Hambúrguer · {eventDay.full}<br />Toda a renda vai para a compra de alimentos para instituições carentes.</p><p className="footer-credit">Site desenvolvido por <strong>Pietro Toledo</strong></p></div></footer>
  </div>;
}
