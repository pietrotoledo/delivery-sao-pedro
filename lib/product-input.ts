import type { Product, ProductCategory } from "./store";

export function parseProductInput(body: Record<string, unknown>, existing?: Product): Omit<Product, "id"> | string {
  const name = String(body.name ?? existing?.name ?? "").trim();
  const description = String(body.description ?? existing?.description ?? "").trim();
  const category = body.category ?? existing?.category;
  const price = Number(body.price ?? existing?.price);
  const imageText = String(body.imageUrl ?? existing?.imageUrl ?? "").trim();
  const active = body.active ?? existing?.active ?? true;
  const sortOrder = Number(body.sortOrder ?? existing?.sortOrder ?? 0);
  const stockValue = body.stock === "" || body.stock === null ? null : body.stock ?? existing?.stock ?? null;
  const stock = stockValue === null ? null : Number(stockValue);

  if (name.length < 2 || name.length > 80) return "O nome deve ter entre 2 e 80 caracteres.";
  if (description.length > 300) return "A descrição pode ter até 300 caracteres.";
  if (!(["burger", "side", "drink"] as unknown[]).includes(category)) return "Escolha uma categoria válida.";
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) return "Informe um preço entre R$ 0,01 e R$ 10.000,00.";
  if (typeof active !== "boolean") return "Informe se o produto está ativo.";
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return "A ordem deve estar entre 0 e 9999.";
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) return "A quantidade deve estar entre 0 e 1.000.000, ou vazia para não limitar.";
  if (imageText.length > 500) return "A URL da imagem é muito longa.";
  if (imageText) {
    if (!/^\/(products|fotos)\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg|avif)$/.test(imageText) && !/^\/api\/products\/images\/[a-f0-9-]{36}$/.test(imageText)) {
      try {
        const url = new URL(imageText);
        if (url.protocol !== "https:" || url.username || url.password) return "Use uma URL HTTPS para a foto.";
      } catch { return "Use uma URL HTTPS ou uma imagem em /products ou /fotos."; }
    }
  }
  return { name, description, category: category as ProductCategory, price, imageUrl: imageText || null, stock, active, sortOrder };
}
