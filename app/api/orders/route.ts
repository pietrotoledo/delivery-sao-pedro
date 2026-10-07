import { config, db, json, menu, sameOrigin } from "@/lib/store";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error:"Origem inválida." }, 403);
  const settings = await config();
  if (settings.paused) return json({ error:"Os pedidos estão pausados no momento." }, 409);
  let body: Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; } catch { return json({error:"Dados inválidos."},400); }
  const name = String(body.name ?? "").trim().slice(0,100);
  const phone = String(body.phone ?? "").replace(/\D/g,"").slice(0,13);
  const method = body.method === "delivery" ? "delivery" : body.method === "pickup" ? "pickup" : null;
  const neighborhood = method === "delivery" ? String(body.neighborhood ?? "").trim() : null;
  const address = method === "delivery" ? String(body.address ?? "").trim().slice(0,220) : null;
  const notes = String(body.notes ?? "").trim().slice(0,300) || null;
  if (name.length < 2 || phone.length < 10 || !method) return json({error:"Informe nome, WhatsApp e modalidade."},400);
  if (method === "delivery" && (!["Manaíra","Bessa","Tambaú"].includes(neighborhood ?? "") || !address || address.length < 8)) {
    return json({error:"Informe um endereço válido em Manaíra, Bessa ou Tambaú."},400);
  }
  if (!Array.isArray(body.items)) return json({error:"Escolha ao menos um hambúrguer."},400);
  const items: {id:string;quantity:number}[] = [];
  for (const candidate of body.items) {
    const raw = candidate as Record<string,unknown>;
    const product = menu.find((p)=>p.id === raw.id);
    const quantity = Number(raw.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > 20 || items.some((i)=>i.id===product.id)) {
      return json({error:"Quantidade ou produto inválido."},400);
    }
    if (quantity) items.push({id:product.id,quantity});
  }
  const burgerCount = items.reduce((sum,item)=>sum+(menu.find(p=>p.id===item.id)?.category==="burger"?item.quantity:0),0);
  if (burgerCount < 1 || burgerCount > 20) return json({error:"Escolha de 1 a 20 hambúrgueres."},400);
  const subtotal = items.reduce((sum,item)=>sum+(menu.find(p=>p.id===item.id)?.price ?? 0)*item.quantity,0);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = method === "delivery" ? "awaiting_quote" : "ready_for_payment";
  await db().prepare("INSERT INTO orders (id,created_at,updated_at,name,phone,method,neighborhood,address,notes,items_json,burger_count,subtotal,delivery_fee,total,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,now,now,name,phone,method,neighborhood,address,notes,JSON.stringify(items),burgerCount,subtotal,method==="pickup"?0:null,method==="pickup"?subtotal:null,status).run();
  return json({id,status},201);
}
