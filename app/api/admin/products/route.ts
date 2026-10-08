import { adminOnly, db, getProducts, json, sameOrigin } from "@/lib/store";
import { parseProductInput } from "@/lib/product-input";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({ error: "Acesso restrito." }, 403);
  return json({ products: await getProducts(true) });
}

export async function POST(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({ error: "Acesso restrito." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Dados inválidos." }, 400); }
  const products = await getProducts(true);
  const input = parseProductInput({ ...body, sortOrder: body.sortOrder ?? (Math.max(0, ...products.map(product => product.sortOrder)) + 10) });
  if (typeof input === "string") return json({ error: input }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db().prepare("INSERT INTO products (id,name,description,category,price,image_url,stock,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,input.name,input.description,input.category,input.price,input.imageUrl,input.stock,input.active ? 1 : 0,input.sortOrder,now,now).run();
  return json({ product: { id, ...input } }, 201);
}
