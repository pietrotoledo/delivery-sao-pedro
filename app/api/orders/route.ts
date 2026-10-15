import { comboDrinkOptions, includesBurger } from "@/lib/menu-options";
import { deliveryFeeFor } from "@/lib/delivery-areas";
import { deliveryAddressError, formatDeliveryAddress, parseDeliveryAddress } from "@/lib/delivery-address";
import { createCheckout } from "@/lib/payment";
import { evolutionEnabled } from "@/lib/evolution-notifications";
import { config, db, ensureSchema, getOrder, getProducts, json, paymentHandle, sameOrigin, type Order, type OrderItem } from "@/lib/store";

async function requestHash(body: Record<string,unknown>) {
  const payload = { ...body };
  delete payload.requestKey;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function existingResponse(order: Order) {
  return json({ id: order.id, status: order.status, ...(order.checkout_url ? { paymentUrl: order.checkout_url } : {}) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error:"Origem inválida." }, 403);
  let body: Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; } catch { return json({error:"Dados inválidos."},400); }
  const requestKey = body.requestKey;
  if (typeof requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)) {
    return json({error:"Atualize a página e tente novamente."},400);
  }
  const hash = await requestHash(body);
  await ensureSchema();
  const previous = await db().prepare("SELECT * FROM orders WHERE request_key = ?").bind(requestKey).first<Order>();
  if (previous) return previous.request_hash === hash ? existingResponse(previous) : json({error:"Esta tentativa já foi usada para outro pedido. Atualize a página."},409);
  const settings = await config();
  if (settings.paused) return json({error:"Os pedidos estão pausados no momento."},409);
  const name = String(body.name ?? "").trim().slice(0,100);
  const phone = String(body.phone ?? "").replace(/\D/g,"").slice(0,13);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0,254);
  const method = body.method === "delivery" ? "delivery" : body.method === "pickup" ? "pickup" : null;
  const structuredAddress = method === "delivery" && body.deliveryAddress !== undefined ? parseDeliveryAddress(body.deliveryAddress) : null;
  if (method === "delivery" && body.deliveryAddress !== undefined) {
    const error = structuredAddress ? deliveryAddressError(structuredAddress) : "Informe um endereço de entrega válido.";
    if (error) return json({ error }, 400);
  }
  const neighborhood = method === "delivery" ? structuredAddress?.neighborhood ?? String(body.neighborhood ?? "").trim() : null;
  const address = method === "delivery" ? structuredAddress ? formatDeliveryAddress(structuredAddress) : String(body.address ?? "").trim().slice(0,220) : null;
  const notes = String(body.notes ?? "").trim().slice(0,300) || null;
  const whatsappOptIn = body.whatsappOptIn === true && evolutionEnabled() ? 1 : 0;
  if (name.length < 2 || phone.length < 10 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !method) return json({error:"Informe nome, WhatsApp, e-mail válido e modalidade."},400);
  const deliveryFee = method === "delivery" ? deliveryFeeFor(neighborhood ?? "") : 0;
  if (deliveryFee === null || (method === "delivery" && (!address || address.length < 8))) {
    return json({error:"Selecione um dos bairros atendidos e informe um endereço completo válido."},400);
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
    const unitRemovals = raw.unitRemovals ?? (includesBurger(product) ? Array.from({ length: quantity }, () => raw.removedIngredients ?? []) : []);
    if (!Array.isArray(unitRemovals) || unitRemovals.length !== (includesBurger(product) ? quantity : 0) || unitRemovals.some(unit => !Array.isArray(unit) || unit.some(value => typeof value !== "string" || !product.ingredients.includes(value)) || new Set(unit).size !== unit.length)) {
      return json({error:"Personalização inválida para este produto."},400);
    }
    const unitDrinks = raw.unitDrinks ?? [];
    if (!Array.isArray(unitDrinks) || unitDrinks.length !== (product.category === "combo" ? quantity : 0) || unitDrinks.some(drink => typeof drink !== "string" || !comboDrinkOptions.includes(drink))) {
      return json({error:"Escolha um refrigerante válido para cada combo."},400);
    }
    if (quantity) items.push({id:product.id,quantity,name:product.name,price:product.price,unitRemovals:unitRemovals as string[][], ...(product.category === "combo" ? {unitDrinks: unitDrinks as string[]} : {})});
  }
  const unavailable = items.find(item => {
    const stock = productsById.get(item.id)?.stock;
    return stock !== null && stock !== undefined && item.quantity > stock;
  });
  if (unavailable) return json({error:`${unavailable.name} não tem a quantidade solicitada. Atualize o cardápio.`},409);
  const burgerCount = items.reduce((sum,item)=>sum+(includesBurger(productsById.get(item.id) ?? { category: "" })?item.quantity:0),0);
  if (!items.length || burgerCount > 20) return json({error:"Escolha pelo menos um item e até 20 hambúrgueres por pedido."},400);
  const subtotal = items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  if (Number(body.expectedSubtotal) !== subtotal) return json({error:"O cardápio mudou. Atualize a página e confira o novo total antes de pedir."},409);
  if (Number(body.expectedDeliveryFee) !== deliveryFee) return json({error:"A taxa de entrega mudou. Atualize a página e confira o total antes de pedir."},409);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = "ready_for_payment";
  const availability = items.map(() => "(id = ? AND active = 1 AND (stock IS NULL OR stock >= ?))").join(" OR ");
  const availabilityArgs = items.flatMap(item => [item.id, item.quantity]);
  const database = db();
  const statements = [
    database.prepare(`INSERT OR IGNORE INTO orders (id,request_key,request_hash,created_at,updated_at,name,phone,email,method,neighborhood,address,notes,items_json,burger_count,subtotal,delivery_fee,total,status,whatsapp_opt_in)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM products WHERE ${availability}) = ?`)
      .bind(id,requestKey,hash,now,now,name,phone,email,method,neighborhood,address,notes,JSON.stringify(items),burgerCount,subtotal,deliveryFee,subtotal+deliveryFee,status,whatsappOptIn,...availabilityArgs,items.length),
    ...items.map(item => database.prepare("UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND stock IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id=?)")
      .bind(item.quantity,now,item.id,id)),
  ];
  const results = await database.batch(statements);
  if (!results[0].meta.changes) {
    const existing = await database.prepare("SELECT * FROM orders WHERE request_key = ?").bind(requestKey).first<Order>();
    if (existing) return existing.request_hash === hash ? existingResponse(existing) : json({error:"Esta tentativa já foi usada para outro pedido. Atualize a página."},409);
    return json({error:"Um produto ficou indisponível. Atualize o cardápio e tente novamente."},409);
  }
  if (paymentHandle()) {
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
