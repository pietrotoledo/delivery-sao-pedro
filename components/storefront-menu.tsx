"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { availableComboDrinks, type ComboDrinkOption } from "@/lib/menu-options";
import { externalPhoto } from "@/lib/product-images";
import { menuBurgerCount, type MenuCart, type MenuProduct } from "@/lib/menu-cart";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});

function DrinkChoice({id, options, disabled, action, onConfirm}: {id: string; options: ComboDrinkOption[]; disabled: boolean; action: string; onConfirm: (drink: string) => void}) {
  const [drink, setDrink] = useState("");
  const validChoice = options.some(option => option.value === drink);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled && validChoice) onConfirm(drink);
  }
  return <form className="menu-drink-choice" onSubmit={submit}>
    <label htmlFor={id}>Escolha a bebida incluída</label>
    <select id={id} required value={validChoice ? drink : ""} disabled={disabled} onChange={event => setDrink(event.target.value)}>
      <option value="" disabled>Selecione sua bebida</option>
      {options.map(option => <option key={option.id} value={option.value}>{option.label}</option>)}
    </select>
    <button className="menu-primary-action" type="submit" disabled={disabled || !validChoice}>{action}<ArrowRight size={18} aria-hidden="true" /></button>
    {!options.length && <small>As bebidas do combo estão indisponíveis no momento.</small>}
  </form>;
}

export default function StorefrontMenu({products, cart, paused, onChange, onAddCombo, onUpgrade}: {
  products: MenuProduct[]; cart: MenuCart; paused: boolean;
  onChange: (id: string, delta: number) => void;
  onAddCombo: (id: string, drink: string) => void;
  onUpgrade: (burgerId: string, comboId: string, drink: string) => void;
}) {
  const [comboOpen, setComboOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const combo = products.find(product => product.category === "combo");
  const burger = products.find(product => product.category === "burger");
  const fries = products.find(product => product.id === "fries-small");
  const extras = products.filter(product => product.category === "side" || product.category === "drink");
  const drinks = availableComboDrinks(products);
  const drinkPrice = Math.min(...drinks.map(drink => drink.price));
  const savings = combo && burger && fries && Number.isFinite(drinkPrice) ? burger.price + fries.price + drinkPrice - combo.price : 0;
  const upgradePrice = combo && burger ? combo.price - burger.price : 0;
  const burgerCount = menuBurgerCount(cart, products);
  const comboQuantity = combo ? cart.quantities[combo.id] ?? 0 : 0;
  const burgerQuantity = burger ? cart.quantities[burger.id] ?? 0 : 0;
  const comboHasRoom = Boolean(combo && comboQuantity < Math.min(20, combo.stock ?? 20) && drinks.length);

  function stepper(product: MenuProduct) {
    const quantity = cart.quantities[product.id] ?? 0;
    const atLimit = quantity >= Math.min(20, product.stock ?? 20) || (product.category === "burger" && burgerCount >= 20);
    return <div className="menu-item-stepper"><button type="button" onClick={() => onChange(product.id, -1)} disabled={paused || quantity < 1} aria-label={`Retirar uma unidade de ${product.name}`}><Minus size={17} /></button><b aria-live="polite">{quantity}</b><button type="button" onClick={() => onChange(product.id, 1)} disabled={paused || atLimit} aria-label={`Adicionar uma unidade de ${product.name}`}><Plus size={17} /></button></div>;
  }

  return <>
    <section className="menu-main-choices" id="hamburgueres" aria-label="Escolha entre combo e hambúrguer individual">
      {combo && <article className="menu-featured-combo" id="combo">
        {combo.imageUrl && <div className="menu-featured-photo"><Image src={combo.imageUrl} unoptimized={externalPhoto(combo.imageUrl)} fill sizes="(max-width: 700px) 100vw, 50vw" alt="Hambúrguer artesanal, batata frita e bebida do combo" /></div>}
        <div className="menu-featured-copy">
          <span className="menu-choice-badge">Sua noite completa</span>
          <div className="menu-featured-heading"><h3>{combo.name}</h3><strong>{money(combo.price)}</strong></div>
          <p>O nosso hambúrguer artesanal com os acompanhamentos que completam o pedido.</p>
          <ul className="menu-combo-includes"><li><Check size={17} aria-hidden="true" />Hambúrguer com carne de 140 g</li><li><Check size={17} aria-hidden="true" />Batata frita</li><li><Check size={17} aria-hidden="true" />Bebida à sua escolha</li></ul>
          {savings > 0 && <p className="menu-combo-saving">Economize {money(savings)} em relação aos itens separados.</p>}
          {combo.stock === 0 ? <p className="menu-item-unavailable">Combo esgotado</p> : comboOpen ? <DrinkChoice id="menu-combo-drink" options={drinks} disabled={paused || !comboHasRoom || burgerCount >= 20} action="Adicionar combo" onConfirm={drink => { onAddCombo(combo.id, drink); setComboOpen(false); setFeedback(`Combo com ${drinks.find(option => option.value === drink)?.label ?? drink} adicionado ao pedido.`); }} /> : comboQuantity === 0 ? <button className="menu-primary-action" type="button" disabled={paused || !comboHasRoom || burgerCount >= 20} onClick={() => setComboOpen(true)}>Escolher meu combo<ArrowRight size={18} aria-hidden="true" /></button> : null}
          {comboOpen && combo.stock !== 0 && <button className="menu-combo-cancel" type="button" onClick={() => setComboOpen(false)}>Cancelar</button>}
          {combo.stock !== 0 && !drinks.length && !comboOpen && <p className="menu-item-unavailable">As bebidas do combo estão indisponíveis no momento.</p>}
          {comboQuantity > 0 && <div className="menu-combo-in-cart"><button type="button" onClick={() => { onChange(combo.id, -1); setComboOpen(false); setFeedback(""); }} disabled={paused} aria-label="Retirar um combo do pedido"><Minus size={16} aria-hidden="true" />Retirar</button><span aria-live="polite">{comboQuantity} {comboQuantity === 1 ? "combo" : "combos"}</span><button type="button" className="menu-combo-add" onClick={() => { setComboOpen(true); setFeedback(""); }} disabled={paused || !comboHasRoom || burgerCount >= 20 || comboOpen} aria-expanded={comboOpen}><Plus size={16} aria-hidden="true" />Adicionar mais</button></div>}
          <p className="menu-selection-feedback" role="status">{feedback}</p>
        </div>
      </article>}
      {burger && <article className="menu-solo-card">
        <div className={`menu-solo-product ${burger.imageUrl ? "has-photo" : ""}`}>
          {burger.imageUrl && <div className="menu-solo-photo"><Image src={burger.imageUrl} unoptimized={externalPhoto(burger.imageUrl)} fill sizes="(max-width: 700px) 112px, 180px" alt="Hambúrguer artesanal com queijo e cebola caramelizada" /></div>}
          <div className="menu-solo-content">
        <div className="menu-solo-heading"><div><h3>Só o hambúrguer</h3><p>{burger.description}</p></div><strong>{money(burger.price)}</strong></div>
        <div className="menu-solo-actions"><small>{burger.stock === 0 ? "Hambúrguer esgotado" : burgerQuantity ? "No seu pedido" : "Para quem quer só o artesanal."}</small>{burgerQuantity ? stepper(burger) : <button className="menu-secondary-action" type="button" disabled={paused || burger.stock === 0 || burgerCount >= 20} onClick={() => onChange(burger.id, 1)}>Adicionar hambúrguer<Plus size={17} aria-hidden="true" /></button>}</div>
          </div>
        </div>
        {combo && burgerQuantity > 0 && comboHasRoom && upgradePrice >= 0 && <div className="menu-upgrade-offer"><p><strong>Complete seu pedido por mais {money(upgradePrice)}.</strong><span>Troque 1 hambúrguer pelo combo com batata e bebida.</span></p>{upgradeOpen ? <DrinkChoice id="menu-upgrade-drink" options={drinks} disabled={paused} action="Trocar 1 hambúrguer pelo combo" onConfirm={drink => { onUpgrade(burger.id, combo.id, drink); setUpgradeOpen(false); setFeedback(`Hambúrguer substituído por um combo com ${drink}.`); }} /> : <button className="menu-upgrade-action" type="button" disabled={paused} onClick={() => setUpgradeOpen(true)}>Trocar pelo combo<ArrowRight size={17} aria-hidden="true" /></button>}</div>}
      </article>}
    </section>
    {extras.length > 0 && <section className="menu-extras" id="acompanhamentos" aria-labelledby="menu-extras-title"><div className="menu-extras-heading"><h3 id="menu-extras-title">Quer acrescentar algo?</h3><p>Batata, bebidas e docinhos para completar o seu pedido.</p></div><div className="menu-extras-grid">{extras.map((product, index) => <article className="menu-extra-card" key={product.id} id={product.category === "drink" && !extras.slice(0, index).some(item => item.category === "drink") ? "bebidas" : undefined}>
      {product.imageUrl && <div className="menu-extra-photo"><Image src={product.imageUrl} unoptimized={externalPhoto(product.imageUrl)} fill sizes="96px" alt="" /></div>}
      <div className="menu-extra-info"><h4>{product.name}</h4><strong>{money(product.price)}</strong><div className="menu-extra-action">{product.stock === 0 ? <span>Esgotado</span> : cart.quantities[product.id] ? stepper(product) : <button className="menu-extra-add" type="button" disabled={paused} onClick={() => onChange(product.id, 1)}>Adicionar<Plus size={17} aria-hidden="true" /></button>}</div></div>
    </article>)}</div></section>}
  </>;
}
