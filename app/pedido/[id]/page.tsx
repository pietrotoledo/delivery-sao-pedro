"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import Link from "next/link";
import BrandAvatar from "@/components/brand-avatar";
const money=(c:number)=>(c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
type Order = {id:string;name:string;method:string;address:string|null;neighborhood:string|null;items:{id:string;quantity:number;name:string;price:number;removedIngredients?:string[]}[];burgerCount:number;subtotal:number;deliveryFee:number|null;total:number|null;status:string;checkoutUrl:string|null;paidAt:string|null};
const names:Record<string,string>={classic:"Hambúrguer Clássico",bacon:"Hambúrguer Bacon","fries-small":"Batata frita pequena","fries-large":"Batata frita grande",water:"Água mineral",coke:"Coca-Cola 350 ml","coke-zero":"Coca-Cola Zero 350 ml"};
const labels:Record<string,string>={awaiting_quote:"Aguardando taxa de entrega",ready_for_payment:"Pronto para pagar",awaiting_payment:"Aguardando Pix",paid:"Pagamento confirmado",preparing:"Em preparo",ready:"Pronto para retirada",out_for_delivery:"Saiu para entrega",completed:"Pedido concluído",refunded:"Devolução registrada"};
export default function OrderPage() {
  const params=useParams();
  const id=String(params.id);
  const [order,setOrder]=useState<Order|null>(null);
  const [demo,setDemo]=useState(false);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{const [o,p]=await Promise.all([fetch(`/api/orders/${id}`).then(r=>r.json() as Promise<{order?:Order}>),fetch("/api/public").then(r=>r.json() as Promise<{demo:boolean}>) ]);if(o.order)setOrder(o.order);setDemo(Boolean(p.demo));},[id]);
  useEffect(()=>{const initial=setTimeout(()=>load().catch(()=>setError("Não foi possível carregar o pedido.")),0);const timer=setInterval(()=>load().catch(()=>{}),8000);return()=>{clearTimeout(initial);clearInterval(timer)}},[load]);
  useEffect(()=>{const query=new URLSearchParams(window.location.search);const transaction_nsu=query.get("transaction_nsu");const slug=query.get("slug");if(transaction_nsu&&slug){fetch(`/api/orders/${id}/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transaction_nsu,slug})}).then(()=>load()).catch(()=>{});}},[id,load]);
  useEffect(()=>{
    if (!order || new URLSearchParams(window.location.search).get("abrir-pix") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("abrir-pix");
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
    if (!order.paidAt && order.checkoutUrl) window.location.assign(order.checkoutUrl);
  },[order]);
  async function pay(){setBusy(true);setError("");try{const r=await fetch(`/api/orders/${id}/checkout`,{method:"POST"});const result=await r.json() as {error?:string;demo?:boolean;url?:string};if(!r.ok)throw new Error(result.error);if(result.demo){setError("Este é um ambiente de demonstração. A equipe pode simular o pagamento no painel.");await load();}else if(result.url){window.location.href=result.url;}}catch(e){setError(e instanceof Error?e.message:"Não foi possível abrir o Pix.");}finally{setBusy(false)}}
  return <div className="order-page"><header className="topbar wrap"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><Link className="nav-cta" href="/">Ver cardápio</Link></header><main className="order-status-wrap"><Link className="backlink" href="/"><ArrowLeft size={16} style={{verticalAlign:"middle"}}/> Voltar ao início</Link><div className="status-header"><p className="section-kicker">Acompanhe sua compra</p><h1>{order?labels[order.status]||"Seu pedido":"Carregando pedido..."}</h1><p>Guarde esta página para acompanhar as atualizações do pedido. Ela atualiza automaticamente.</p></div>
    {order&&<><div className="status-card order-details-card"><h2>Pedido #{order.id.slice(0,8).toUpperCase()}</h2><div className="order-id-tools"><span>ID: <code>{order.id}</code></span><button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pedido/${order.id}`).then(() => setCopied(true)).catch(() => setError("Não foi possível copiar o link."))}>{copied ? "Link copiado" : "Copiar link do pedido"}</button></div><div className="status-list"><div className="status-line"><span>Nome</span><strong>{order.name}</strong></div><div className="status-line"><span>Recebimento</span><strong>{order.method==="delivery"?"Entrega":"Retirada"}</strong></div>{order.method==="delivery"&&<div className="status-line"><span>Endereço</span><strong>{order.address} · {order.neighborhood}</strong></div>}{order.items.map(item=><div className="status-line" key={item.id}><span>{item.quantity}× {item.name || names[item.id] || item.id}{item.removedIngredients?.length ? ` — Sem ${item.removedIngredients.join(", ").toLowerCase()}` : ""}</span></div>)}<div className="status-line"><span>Produtos</span><strong>{money(order.subtotal)}</strong></div>{order.method==="delivery"&&<div className="status-line"><span>Taxa de entrega</span><strong>{order.deliveryFee===null?"A definir":money(order.deliveryFee)}</strong></div>}<div className="status-line"><span>Total</span><strong>{order.total===null?"Após definir entrega":money(order.total)}</strong></div></div></div>
      <div className="status-card"><h2>Próximo passo</h2>{order.status==="awaiting_quote"?<div className="status-highlight"><Clock3 size={20} style={{verticalAlign:"middle"}}/> A equipe vai definir a taxa de entrega. Volte a esta página para ver o total antes de pagar.</div>:null}
      {(order.status==="ready_for_payment"||order.status==="awaiting_payment")&&<><div className="status-highlight">Revise o valor total. Seu pedido só será confirmado depois que o Pix for aprovado pela InfinitePay.</div><div className="status-actions">{order.checkoutUrl?<a className="button button-yellow" href={order.checkoutUrl}>Abrir Pix novamente <ArrowRight size={18}/></a>:<button className="button button-yellow" disabled={busy} onClick={pay}>{busy?"Preparando Pix...":"Pagar com Pix"} <ArrowRight size={18}/></button>}<button className="button button-outline" onClick={()=>load()}><RefreshCw size={17}/> Atualizar</button></div></>}
      {order.paidAt&&order.status!=="refunded"&&<div className="status-highlight"><CheckCircle2 size={20} style={{verticalAlign:"middle"}}/> Pagamento registrado. {order.method==="pickup"?"Retirada na Paróquia São Pedro Pescador, das 18h às 22h em 29/10.":"Acompanhe aqui a preparação e a saída para entrega."}</div>}
      {order.status==="refunded"&&<div className="status-highlight">A equipe registrou a devolução deste pedido. Se houver dúvida, entre em contato com a organização.</div>}
      {demo&&<p className="demo-badge" style={{marginTop:18}}>Ambiente de demonstração: nenhum Pix real é cobrado.</p>}{error&&<p className="form-error" role="alert">{error}</p>}</div></>}
    {!order&&error&&<p className="form-error">{error}</p>}</main></div>;
}
