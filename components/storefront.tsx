"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock3, MapPin, Minus, Plus, ShoppingBag, Truck } from "lucide-react";

type Product = {id:string;name:string;price:number;category:string;description:string};
type PublicData = {menu:Product[];capacity:number;paid:number;paused:boolean;demo:boolean};
const money = (c:number) => (c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function Storefront() {
  const [data,setData] = useState<PublicData|null>(null);
  const [quantities,setQuantities] = useState<Record<string,number>>({});
  const [method,setMethod] = useState<"pickup"|"delivery">("pickup");
  const [neighborhood,setNeighborhood] = useState("Manaíra");
  const [name,setName] = useState("");
  const [phone,setPhone] = useState("");
  const [address,setAddress] = useState("");
  const [notes,setNotes] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{ fetch("/api/public").then(r=>r.json() as Promise<PublicData>).then(setData).catch(()=>setError("Não foi possível carregar o cardápio.")); },[]);
  const items = useMemo(()=>data?.menu.filter(p=>(quantities[p.id]??0)>0).map(p=>({id:p.id,quantity:quantities[p.id]}))??[],[data,quantities]);
  const burgerCount = (quantities.classic??0)+(quantities.bacon??0);
  const subtotal = data?.menu.reduce((sum,p)=>sum+p.price*(quantities[p.id]??0),0)??0;
  function change(id:string, delta:number) { setQuantities(current=>({...current,[id]:Math.max(0,Math.min(20,(current[id]??0)+delta))})); }
  async function submit(event:React.FormEvent) {
    event.preventDefault(); setError("");
    if (burgerCount<1) { setError("Adicione pelo menos um hambúrguer."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,phone,method,neighborhood,address,notes,items})});
      const result = await response.json() as {id?:string;error?:string};
      if (!response.ok) throw new Error(result.error||"Não foi possível criar o pedido.");
      window.location.href = `/pedido/${result.id}`;
    } catch (err) { setError(err instanceof Error?err.message:"Falha ao criar pedido."); setBusy(false); }
  }
  return <div className="site-shell">
    <header className="topbar wrap">
      <a className="brand" href="/" aria-label="BLUECKYARDIGANS, início"><span className="brand-mark">B<span>.</span></span><span>BLUECKYARDIGANS</span></a>
      <nav className="toplinks" aria-label="Navegação"><a href="#cardapio">Cardápio</a><a href="#como-funciona">Como funciona</a><a href="/admin">Painel</a></nav>
      <a className="nav-cta" href="#pedido">Fazer pedido <ArrowRight size={17}/></a>
    </header>
    <main>
      <section className="hero">
        <div className="hero-inner wrap">
          <div className="hero-copy">
            <div className="event-chip"><span className="event-dot"/> Quinta, 29 de outubro · 18h às 22h</div>
            <h1>O sabor da<br/><em>nossa gincana.</em></h1>
            <p>Dois hambúrgueres, um motivo para reunir todo mundo. Garanta o seu antecipadamente e escolha entrega ou retirada.</p>
            <div className="hero-actions"><a className="button button-yellow" href="#cardapio">Escolher meu hambúrguer <ArrowRight size={19}/></a><span>Pix · compra antecipada</span></div>
            <div className="hero-facts"><span><MapPin size={17}/> Paróquia São Pedro Pescador</span><span><Clock3 size={17}/> Retirada e entrega: 18h–22h</span></div>
          </div>
          <div className="hero-visual"><div className="hero-orbit"/><img src="/mascote.png" alt="Mascote azul e amarelo dos Blueckyardigans" /><div className="hero-sticker"><strong>29</strong><span>OUT</span></div></div>
        </div>
      </section>
      <section className="ribbon"><div className="wrap ribbon-inner"><span>Feito para a gincana</span><span className="ribbon-star">✦</span><span>Pedido antecipado</span><span className="ribbon-star">✦</span><span>Retire ou receba em casa</span></div></section>
      <section className="menu-section wrap" id="cardapio">
        <div className="section-head"><div><p className="section-kicker">O cardápio</p><h2>Escolha os seus favoritos.</h2></div><p>Uma noite especial pede uma escolha simples. Selecione as quantidades e finalize seu pedido abaixo.</p></div>
        <div className="menu-grid">
          {data?.menu.map((p,i)=><article className="product-card" key={p.id}>
            <div className={`product-art art-${p.id}`} aria-hidden="true"><span>{p.category==="burger"?"🍔":"🥤"}</span></div>
            <div className="product-info"><div className="product-title"><h3>{p.name}</h3><strong>{money(p.price)}</strong></div><p>{p.description}</p><div className="quantity"><span>{p.category==="burger"?"Hambúrguer":"Bebida"}</span><div className="stepper"><button type="button" aria-label={`Diminuir ${p.name}`} onClick={()=>change(p.id,-1)}><Minus size={16}/></button><b>{quantities[p.id]??0}</b><button type="button" aria-label={`Aumentar ${p.name}`} onClick={()=>change(p.id,1)}><Plus size={16}/></button></div></div></div>
          </article>)}
        </div>
        <p className="fiction-note">Bebidas: lata de 350 ml e preços provisórios para esta versão.</p>
      </section>
      <section className="order-section" id="pedido"><div className="wrap order-layout">
        <div className="order-intro"><p className="section-kicker">Seu pedido</p><h2>Tá quase na<br/>hora de comer.</h2><p>Escolha como quer receber. Se for entrega, a taxa será informada antes de você gerar o Pix.</p><div className="pickup-box"><MapPin size={22}/><div><b>Local de retirada</b><span>Paróquia São Pedro Pescador<br/>Av. Maria Rosa, 1124 · Manaíra, João Pessoa</span></div></div></div>
        <form className="order-card" onSubmit={submit}>
          <div className="order-card-head"><ShoppingBag size={23}/><h3>Finalizar pedido</h3></div>
          <div className="method-options"><button type="button" className={method==="pickup"?"selected":""} onClick={()=>setMethod("pickup")}><MapPin size={20}/><span>Vou retirar<small>Na paróquia</small></span>{method==="pickup"&&<Check size={17}/>}</button><button type="button" className={method==="delivery"?"selected":""} onClick={()=>setMethod("delivery")}><Truck size={20}/><span>Quero entrega<small>Taxa antes do Pix</small></span>{method==="delivery"&&<Check size={17}/>}</button></div>
          <div className="fields"><label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Como podemos chamar você?" required minLength={2}/></label><label>WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="(83) 99999-9999" required/></label>
          {method==="delivery"&&<><label>Bairro<select value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}><option>Manaíra</option><option>Bessa</option><option>Tambaú</option></select></label><label>Endereço completo<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número, complemento e referência" required minLength={8}/></label></>}
          <label>Observações <span className="optional">opcional</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Alguma informação para a equipe?" rows={2}/></label></div>
          <div className="order-totals"><div><span>{burgerCount} hambúrguer{burgerCount===1?"":"es"} · {items.reduce((s,i)=>s+i.quantity,0)} item{items.reduce((s,i)=>s+i.quantity,0)===1?"":"s"}</span><strong>{money(subtotal)}</strong></div>{method==="delivery"&&<p>Taxa de entrega informada antes do pagamento.</p>}</div>
          {data && data.paid>=data.capacity && <div className="notice">A produção prevista já foi atingida. Seu pedido poderá depender de disponibilidade; se não for atendido, o pagamento será devolvido.</div>}
          {data?.paused&&<div className="notice">Os pedidos estão pausados no momento.</div>}
          {error&&<p className="form-error" role="alert">{error}</p>}
          <button className="button button-yellow submit-button" type="submit" disabled={busy||data?.paused||!data}>{busy?"Criando pedido...":method==="delivery"?"Pedir valor da entrega":"Continuar para o Pix"}<ArrowRight size={19}/></button>
          <p className="form-foot">Pix pela InfinitePay · Evento em 29/10/2026</p>
        </form>
      </div></section>
      <section className="how-section wrap" id="como-funciona"><h2>Simples do começo ao fim.</h2><div className="how-grid"><div><span>1</span><h3>Escolha</h3><p>Monte seu pedido e escolha retirada ou entrega.</p></div><div><span>2</span><h3>Confirme</h3><p>Para entrega, veja a taxa antes de pagar. Depois, finalize no Pix.</p></div><div><span>3</span><h3>Aproveite</h3><p>Acompanhe o pedido e receba no dia da gincana.</p></div></div></section>
    </main>
    <footer><div className="wrap footer-inner"><b>BLUECKYARDIGANS<span>®</span></b><p>Noite do Hambúrguer · 29 de outubro de 2026</p><a href="/admin">Acesso da equipe</a></div></footer>
  </div>;
}
