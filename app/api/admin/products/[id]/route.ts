import { adminOnly, db, getProducts, json, sameOrigin } from "@/lib/store";
import { parseProductInput } from "@/lib/product-input";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({ error: "Acesso restrito." }, 403);
  const { id } = await context.params;
  const products = await getProducts(true);
  const existing = products.find(product => product.id === id);
  if (!existing) return json({ error: "Produto não encontrado." }, 404);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Dados inválidos." }, 400); }
  const input = parseProductInput(body, existing);
  if (typeof input === "string") return json({ error: input }, 400);
  if (existing.category === "burger" && existing.active && (!input.active || input.category !== "burger")) {
    const otherBurgers = products.filter(product => product.id !== id && product.active && product.category === "burger");
    if (!otherBurgers.length) return json({ error: "Mantenha ao menos um hambúrguer ativo para aceitar pedidos." }, 409);
  }
  await db().prepare("UPDATE products SET name=?,description=?,category=?,price=?,image_url=?,active=?,sort_order=?,updated_at=? WHERE id=?")
    .bind(input.name,input.description,input.category,input.price,input.imageUrl,input.active ? 1 : 0,input.sortOrder,new Date().toISOString(),id).run();
  return json({ product: { id, ...input } });
}
