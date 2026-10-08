import { allowedRemovals } from "@/lib/burger-customization";
import { createCheckout } from "@/lib/payment";
import { config, db, getOrder, getProducts, json, paymentHandle, sameOrigin, type OrderItem } from "@/lib/store";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error:"Origem inválida." }, 403);
  const settings = await config();
  if (settings.paused) return json({ error:"Os pedidos estão pausados no momento." }, 409);
  let body: Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; } catch { return json({error:"Dados inválidos."},400); }
  const name = String(body.name ?? "").trim().slice(0,100);
  const phone = String(body.phone ?? "").replace(/\D/g,"").slice(0,13);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0,254);
  const method = body.method === "delivery" ? "delivery" : body.method === "pickup" ? "pickup" : null;
  const neighborhood = method === "delivery" ? String(body.neighborhood ?? "").trim() : null;
  const address = method === "delivery" ? String(body.address ?? "").trim().slice(0,220) : null;
  const notes = String(body.notes ?? "").trim().slice(0,300) || null;
  if (name.length < 2 || phone.length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !method) return json({error:"Informe nome, WhatsApp, e-mail válido e modalidade."},400);
  if (method === "delivery" && (!["Manaíra","Bessa","Tambaú"].includes(neighborhood ?? "") || !address || address.length < 8)) {
    return json({error:"Informe um endereço válido em Manaíra, Bessa ou Tambaú."},400);
  }
  if (!Array.isArray(body.items) || body.items.length > 20) return json({error:"Escolha até 20 tipos de produto por pedido."},400);
  const menu = await getProducts();
  const productsById = new Map(menu.map(product => [product.id, product]));
  const items: OrderItem[] = [];
  for (const candidate of body.items) {
    const raw = candidate && typeof candidate === "object" ? candidate as Record<string,unknown> : {};
    const product = productsById.get(String(raw.id ?? ""));
    const quantity = Number(raw.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > 20 || items.some((i)=>i.id===product.id)) {
      return json({error:"Quantidade ou produto inválido."},400);
    }
    const removed = raw.removedIngredients ?? [];
    if (!Array.isArray(removed) || removed.some(value => typeof value !== "string" || !allowedRemovals(product.id).includes(value)) || new Set(removed).size !== removed.length) {
      return json({error:"Personalização inválida para este produto."},400);
    }
    if (quantity) items.push({id:product.id,quantity,name:product.name,price:product.price,removedIngredients:removed as string[]});
  }
  const unavailable = items.find(item => {
    const stock = productsById.get(item.id)?.stock;
    return stock !== null && stock !== undefined && item.quantity > stock;
  });
  if (unavailable) return json({error:`${unavailable.name} não tem a quantidade solicitada. Atualize o cardápio.`},409);
  const burgerCount = items.reduce((sum,item)=>sum+(productsById.get(item.id)?.category==="burger"?item.quantity:0),0);
  if (burgerCount < 1 || burgerCount > 20) return json({error:"Escolha de 1 a 20 hambúrgueres."},400);
  const subtotal = items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  if (Number(body.expectedSubtotal) !== subtotal) return json({error:"O cardápio mudou. Atualize a página e confira o novo total antes de pedir."},409);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = method === "delivery" ? "awaiting_quote" : "ready_for_payment";
  const availability = items.map(() => "(id = ? AND active = 1 AND (stock IS NULL OR stock >= ?))").join(" OR ");
  const availabilityArgs = items.flatMap(item => [item.id, item.quantity]);
  const database = db();
  const statements = [
    database.prepare(`INSERT INTO orders (id,created_at,updated_at,name,phone,email,method,neighborhood,address,notes,items_json,burger_count,subtotal,delivery_fee,total,status)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM products WHERE ${availability}) = ?`)
      .bind(id,now,now,name,phone,email,method,neighborhood,address,notes,JSON.stringify(items),burgerCount,subtotal,method==="pickup"?0:null,method==="pickup"?subtotal:null,status,...availabilityArgs,items.length),
    ...items.map(item => database.prepare("UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id=?)")
      .bind(item.quantity,now,item.id,id)),
  ];
  const results = await database.batch(statements);
  if (!results[0].meta.changes) return json({error:"Um produto ficou indisponível. Atualize o cardápio e tente novamente."},409);
  if (method === "pickup" && paymentHandle()) {
    try {
      const order = await getOrder(id);
      if (order) {
        const checkout = await createCheckout(order, new URL(request.url).origin);
        if (!checkout.demo) return json({id,status:"awaiting_payment",paymentUrl:checkout.url},201);
      }
    } catch {
      // O pedido já existe; o comprador pode gerar o link na página do pedido.
    }
  }
  return json({id,status},201);
}
