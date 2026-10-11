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
  if (input.category === "burger" && input.active && products.some(product => product.id !== id && product.category === "burger" && product.active)) return json({ error: "O cardápio permite apenas um hambúrguer ativo." }, 409);
  await db().prepare("UPDATE products SET name=?,description=?,category=?,price=?,image_url=?,stock=?,active=?,sort_order=?,ingredients_json=?,updated_at=? WHERE id=?")
    .bind(input.name,input.description,input.category,input.price,input.imageUrl,input.stock,input.active ? 1 : 0,input.sortOrder,JSON.stringify(input.ingredients),new Date().toISOString(),id).run();
  return json({ product: { id, ...input } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({ error: "Acesso restrito." }, 403);
  await getProducts(true);
  const { id } = await context.params;
  const result = await db().prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return json({ error: "Produto não encontrado." }, 404);
  return json({ ok: true });
}
