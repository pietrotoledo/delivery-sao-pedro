import { env } from "cloudflare:workers";

export type ProductCategory = "burger" | "side" | "drink";
export type Product = {
  id: string; name: string; description: string; category: ProductCategory;
  price: number; imageUrl: string | null; active: boolean; sortOrder: number;
};
export type OrderItem = { id: string; quantity: number; name: string; price: number; removedIngredients?: string[] };

export const menu = [
  { id: "classic", name: "Clássico", price: 2200, category: "burger", description: "Carne, queijo, alface, tomate e molho da casa.", imageUrl: "/products/classic.webp" },
  { id: "bacon", name: "Bacon", price: 2700, category: "burger", description: "Carne, queijo, bacon crocante e molho da casa.", imageUrl: "/products/bacon.webp" },
  { id: "fries-small", name: "Batata pequena", price: 800, category: "side", description: "Batata frita crocante · porção pequena.", imageUrl: "/products/fries-small.webp" },
  { id: "fries-large", name: "Batata grande", price: 1200, category: "side", description: "Batata frita crocante · porção grande.", imageUrl: "/products/fries-large.webp" },
  { id: "water", name: "Água mineral", price: 350, category: "drink", description: "Água mineral · unidade.", imageUrl: "/products/water.webp" },
  { id: "coke", name: "Coca-Cola", price: 600, category: "drink", description: "Lata 350 ml.", imageUrl: "/products/cola-lata.webp" },
  { id: "coke-zero", name: "Coca-Cola Zero", price: 600, category: "drink", description: "Lata 350 ml.", imageUrl: "/products/cola-zero.webp" },
] as const;

export type Order = {
  id: string; created_at: string; updated_at: string; name: string; phone: string; email: string | null;
  method: "pickup" | "delivery"; neighborhood: string | null; address: string | null;
  notes: string | null; items_json: string; burger_count: number; subtotal: number;
  delivery_fee: number | null; total: number | null; status: string;
  payment_mode: string | null; checkout_url: string | null; invoice_slug: string | null;
  transaction_nsu: string | null; paid_at: string | null; payment_note: string | null; refund_note: string | null;
};

export function db() {
  if (!env.DB) throw new Error("Banco de dados indisponível");
  return env.DB;
}

let schemaPromise: Promise<void> | undefined;

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const database = db();
      await database.prepare(`CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY NOT NULL, created_at text NOT NULL, updated_at text NOT NULL,
        name text NOT NULL, phone text NOT NULL, email text, method text NOT NULL,
        neighborhood text, address text, notes text, items_json text NOT NULL,
        burger_count integer NOT NULL, subtotal integer NOT NULL, delivery_fee integer,
        total integer, status text NOT NULL, payment_mode text, checkout_url text,
        invoice_slug text, transaction_nsu text, paid_at text, payment_note text, refund_note text
      )`).run();
      const columns = await database.prepare("PRAGMA table_info(orders)").all<{name:string}>();
      if (!columns.results?.some(column => column.name === "email")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN email text").run();
      }
      if (!columns.results?.some(column => column.name === "payment_note")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN payment_note text").run();
      }
      await database.prepare(`CREATE TABLE IF NOT EXISTS settings (
        id integer PRIMARY KEY NOT NULL, capacity integer DEFAULT 100 NOT NULL,
        paused integer DEFAULT false NOT NULL
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS products (
        id text PRIMARY KEY NOT NULL, name text NOT NULL, description text NOT NULL,
        category text NOT NULL, price integer NOT NULL, image_url text,
        active integer NOT NULL DEFAULT 1, sort_order integer NOT NULL DEFAULT 0,
        created_at text NOT NULL, updated_at text NOT NULL
      )`).run();
      const existing = await database.prepare("SELECT COUNT(*) AS count FROM products").first<{count:number}>();
      if (!existing?.count) {
        const now = new Date().toISOString();
        for (const [index, product] of menu.entries()) {
          await database.prepare("INSERT OR IGNORE INTO products (id,name,description,category,price,image_url,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(product.id,product.name,product.description,product.category,product.price,product.imageUrl,1,(index+1)*10,now,now).run();
        }
      }
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export function paymentHandle() { return env.INFINITEPAY_HANDLE?.trim() || ""; }

type ProductRow = {
  id: string; name: string; description: string; category: ProductCategory;
  price: number; image_url: string | null; active: number; sort_order: number;
};

export async function getProducts(includeInactive = false): Promise<Product[]> {
  await ensureSchema();
  const result = await db().prepare(`SELECT id,name,description,category,price,image_url,active,sort_order FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, created_at, id`).all<ProductRow>();
  return result.results.map(row => ({
    id: row.id, name: row.name, description: row.description, category: row.category,
    price: row.price, imageUrl: row.image_url, active: Boolean(row.active), sortOrder: row.sort_order,
  }));
}

export function orderItems(order: Order): OrderItem[] {
  const saved = JSON.parse(order.items_json) as {id:string;quantity:number;name?:string;price?:number;removedIngredients?:string[]}[];
  return saved.map(item => {
    const original = menu.find(product => product.id === item.id);
    return { id: item.id, quantity: item.quantity, name: item.name ?? original?.name ?? item.id, price: item.price ?? original?.price ?? 0, removedIngredients: item.removedIngredients ?? [] };
  });
}

export async function config() {
  await ensureSchema();
  const row = await db().prepare("SELECT capacity, paused FROM settings WHERE id = 1").first<{capacity:number;paused:number}>();
  return { capacity: row?.capacity ?? 100, paused: Boolean(row?.paused) };
}

export async function paidCount() {
  await ensureSchema();
  const row = await db().prepare("SELECT COALESCE(SUM(burger_count),0) AS count FROM orders WHERE paid_at IS NOT NULL AND status != 'refunded'").first<{count:number}>();
  return row?.count ?? 0;
}

export async function getOrder(id: string) {
  await ensureSchema();
  return await db().prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>();
}

export function publicOrder(order: Order) {
  return {
    id: order.id, createdAt: order.created_at, name: order.name,
    method: order.method, neighborhood: order.neighborhood, address: order.address,
    notes: order.notes, items: orderItems(order), burgerCount: order.burger_count,
    subtotal: order.subtotal, deliveryFee: order.delivery_fee, total: order.total,
    status: order.status, checkoutUrl: order.checkout_url, paidAt: order.paid_at,
  };
}

async function sessionSignature(secret:string) {
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("blueckyardigans-admin-v1")));
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}

export async function adminOnly(request: Request) {
  if (env.ADMIN_PASSWORD) {
    const cookie=request.headers.get("cookie")||"";
    const token=cookie.match(/(?:^|; )blueck_admin=([a-f0-9]+)/)?.[1];
    return token===await sessionSignature(env.ADMIN_PASSWORD);
  }
  return false;
}

export async function loginSession(password:string) {
  if (!env.ADMIN_PASSWORD || password!==env.ADMIN_PASSWORD) return null;
  return await sessionSignature(env.ADMIN_PASSWORD);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
