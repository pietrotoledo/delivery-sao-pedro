"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

type MenuProduct = { id: string; name: string; description: string; category: string; price: number; imageUrl: string | null };
const categories = [["combo", "Pra matar a saudade"], ["burger", "Nossos hambúrgueres"], ["side", "Vai bem junto"], ["drink", "Pra acompanhar"]];
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PausedMenu() {
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    requestJson<{ products: MenuProduct[] }>("/api/menu", { signal: controller.signal })
      .then(({ response, result }) => {
        if (!response.ok || !Array.isArray(result.products)) throw new Error("Menu unavailable");
        if (!controller.signal.aborted) { setProducts(result.products); setState("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [attempt]);

  return <section className="paused-menu" id="cardapio" aria-labelledby="paused-menu-title">
    <div className="poster-wrap">
      <div className="paused-menu-heading"><div><p className="poster-event">Pode olhar. Pode ficar com vontade.</p><h2 id="paused-menu-title">O cardápio continua por aqui.</h2></div><span className="menu-view-only">Só uma espiadinha · vendas em pausa</span></div>
      <p className="paused-menu-note">Já vai escolhendo o seu favorito! Os pedidos voltam na última semana de novembro de 2026. Produtos e valores serão confirmados na reabertura.</p>
      <div aria-live="polite" aria-busy={state === "loading"}>
        {state === "loading" && <p className="menu-feedback">Preparando o cardápio para você…</p>}
        {state === "error" && <div className="menu-feedback"><p>Não foi possível carregar o cardápio agora.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
        {state === "ready" && products.length === 0 && <p className="menu-feedback">Estamos preparando o cardápio da próxima edição. Volte em breve!</p>}
      </div>
      {categories.map(([category, title]) => {
        const items = products.filter(product => product.category === category);
        return items.length > 0 && <div className="paused-menu-category" key={category}><h3>{title}</h3><div className="paused-menu-grid">{items.map(product => <article className="paused-menu-item" key={product.id}>
          {product.imageUrl && <div className="paused-menu-image"><Image src={product.imageUrl} alt={product.name} width={480} height={360} sizes="(max-width: 600px) 85vw, (max-width: 900px) 45vw, 28vw" /></div>}
          <div className="paused-menu-item-copy"><h4>{product.name}</h4><p>{product.description}</p><span className="paused-menu-price">{currency.format(product.price / 100)}</span></div>
        </article>)}</div></div>;
      })}
    </div>
  </section>;
}
