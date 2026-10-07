"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, Pencil, Plus, X } from "lucide-react";
import { externalPhoto, productPhoto } from "@/lib/product-images";

type Product = {
  id: string; name: string; description: string; category: "burger" | "side" | "drink";
  price: number; imageUrl: string | null; active: boolean; sortOrder: number;
};
type Form = Omit<Product, "id" | "price" | "imageUrl"> & { price: string; imageUrl: string };
const empty: Form = { name: "", description: "", category: "burger", price: "", imageUrl: "", active: true, sortOrder: 0 };
const categoryNames = { burger: "Hambúrguer", side: "Acompanhamento", drink: "Bebida" };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toForm = (product: Product): Form => ({ ...product, price: (product.price / 100).toFixed(2).replace(".", ","), imageUrl: product.imageUrl ?? "" });

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    const result = await response.json() as { products?: Product[]; error?: string };
    if (!response.ok || !result.products) throw new Error(result.error || "Não foi possível carregar os produtos.");
    setProducts(result.products);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => load().catch(failure => setError(failure.message)).finally(() => setLoading(false)), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function start(product?: Product) {
    setError(""); setNotice("");
    setEditing(product?.id ?? "new");
    setForm(product ? toForm(product) : { ...empty, sortOrder: Math.max(0, ...products.map(item => item.sortOrder)) + 10 });
    window.setTimeout(() => document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    const value = Number(form.price.trim().replace(",", "."));
    const price = Math.round(value * 100);
    if (!Number.isFinite(value) || value <= 0 || Math.abs(price / 100 - value) > .00001) {
      setError("Informe um preço válido com até duas casas decimais."); return;
    }
    setSaving(true);
    try {
      const isNew = editing === "new";
      const response = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${editing}`, {
        method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o produto.");
      await load();
      setEditing(null);
      setNotice(isNew ? "Produto criado e disponível no cardápio." : "Produto atualizado no cardápio.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar o produto."); }
    finally { setSaving(false); }
  }

  async function toggle(product: Product) {
    setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar a disponibilidade.");
      await load();
      setNotice(product.active ? "Produto ocultado do cardápio." : "Produto disponível no cardápio.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível alterar a disponibilidade."); }
  }

  const previewUrl = form.imageUrl.trim();
  const validPreview = previewUrl.startsWith("/products/") || previewUrl.startsWith("/fotos/") || previewUrl.startsWith("https://");

  return <section className="admin-products">
    <div className="admin-products-toolbar"><div><p className="section-kicker">Cardápio da loja</p><h2>Produtos <span>({products.length})</span></h2><p>Edite preços e informações. As mudanças aparecem no cardápio ao atualizar a página.</p></div><button type="button" className="admin-primary" onClick={() => start()}><Plus size={17} /> Novo produto</button></div>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {notice && <p className="admin-success" role="status"><Check size={17} /> {notice}</p>}
    {editing && <form className="admin-panel product-form" id="product-form" onSubmit={save}>
      <div className="admin-panel-heading"><div><p className="section-kicker">{editing === "new" ? "Adicionar ao cardápio" : "Editar produto"}</p><h2>{editing === "new" ? "Novo produto" : form.name}</h2></div><button type="button" className="product-close" onClick={() => setEditing(null)} aria-label="Fechar formulário"><X size={20} /></button></div>
      <div className="product-form-grid">
        <label>Nome<input required minLength={2} maxLength={80} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Hambúrguer especial" /></label>
        <label>Categoria<select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value as Product["category"] }))}><option value="burger">Hambúrguer</option><option value="side">Acompanhamento</option><option value="drink">Bebida</option></select></label>
        <label>Preço (R$)<input required inputMode="decimal" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} placeholder="Ex.: 22,00" /></label>
        <label>Ordem no cardápio<input required type="number" min={0} max={9999} value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
        <label className="product-wide">Descrição<textarea maxLength={300} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Ingredientes, tamanho ou detalhes importantes" /></label>
        <label className="product-wide">URL da foto<input value={form.imageUrl} onChange={event => setForm(current => ({ ...current, imageUrl: event.target.value }))} placeholder="https://... ou /products/foto.webp" /><small>Use uma imagem HTTPS ou uma foto já salva em /products ou /fotos. Deixe vazio para usar uma foto padrão.</small></label>
      </div>
      {validPreview && <div className="product-preview"><Image src={previewUrl} unoptimized={externalPhoto(previewUrl)} width={110} height={88} alt="Prévia do produto" /><span>Prévia da foto</span></div>}
      <label className="product-active"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} /> Disponível no cardápio</label>
      <div className="product-form-actions"><button type="submit" className="admin-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</button><button type="button" className="admin-secondary" onClick={() => setEditing(null)}>Cancelar</button></div>
    </form>}
    {loading ? <div className="admin-panel" role="status">Carregando produtos...</div> : <div className="product-list">{products.map(product => <article className={`product-row ${product.active ? "" : "is-inactive"}`} key={product.id}>
      <div className="product-row-image"><Image src={productPhoto(product)} unoptimized={externalPhoto(productPhoto(product))} width={84} height={84} alt="" /></div>
      <div className="product-row-copy"><div><span className="product-category">{categoryNames[product.category]}</span><span className={`product-status ${product.active ? "" : "is-inactive"}`}>{product.active ? "Disponível" : "Oculto"}</span></div><h3>{product.name}</h3><p>{product.description || "Sem descrição"}</p></div>
      <strong className="product-row-price">{money(product.price)}</strong>
      <div className="product-row-actions"><button type="button" onClick={() => start(product)}><Pencil size={15} /> Editar</button><button type="button" onClick={() => toggle(product)}>{product.active ? "Ocultar" : "Ativar"}</button></div>
    </article>)}{products.length === 0 && <p className="admin-empty">Nenhum produto cadastrado.</p>}</div>}
  </section>;
}
