import { env } from "cloudflare:workers";
import { hamburgerIngredients, includesBurger } from "./menu-options";

export type ProductCategory = "burger" | "combo" | "side" | "drink";
export type Product = {
  id: string; name: string; description: string; category: ProductCategory;
  price: number; imageUrl: string | null; stock: number | null; active: boolean; sortOrder: number;
  ingredients: string[];
};
export type OrderItem = { id: string; quantity: number; name: string; price: number; removedIngredients?: string[]; unitRemovals?: string[][]; unitDrinks?: string[] };

export const menu = [
  { id: "classic", name: "Hambúrguer artesanal", price: 2500, category: "burger", description: "Carne de 140 g, queijo, cebola caramelizada e maionese.", imageUrl: "/products/hamburguer-solo-azul.webp" },
  { id: "combo", name: "Combo da noite", price: 3500, category: "combo", description: "Hambúrguer artesanal + batata frita + bebida à escolha: Coca-Cola normal, Coca-Cola Zero, Guaraná ou água com gás.", imageUrl: "/products/combo-azul-v2.webp" },
  { id: "fries-small", name: "Batata frita individual", price: 800, category: "side", description: "Porção individual de batata frita.", imageUrl: "/products/batata-azul.webp" },
  { id: "coke", name: "Coca-Cola normal", price: 600, category: "drink", description: "Coca-Cola original.", imageUrl: "/products/coca-original-azul.webp" },
  { id: "coke-zero", name: "Coca-Cola Zero", price: 600, category: "drink", description: "Coca-Cola sem açúcar.", imageUrl: "/products/coca-zero-azul.webp" },
  { id: "guarana", name: "Guaraná", price: 600, category: "drink", description: "Refrigerante de guaraná.", imageUrl: "/products/guarana-azul.webp" },
  { id: "water", name: "Água mineral", price: 300, category: "drink", description: "Água mineral.", imageUrl: "/products/water.webp" },
  { id: "sparkling-water", name: "Água com gás", price: 400, category: "drink", description: "Água mineral com gás.", imageUrl: "/products/sparkling-water.png" },
] as const;

export type Order = {
  id: string; request_key: string | null; request_hash: string | null; created_at: string; updated_at: string; name: string; phone: string; email: string | null;
  method: "pickup" | "delivery"; neighborhood: string | null; address: string | null;
  notes: string | null; items_json: string; burger_count: number; subtotal: number;
  delivery_fee: number | null; total: number | null; status: string;
  payment_mode: string | null; checkout_url: string | null; invoice_slug: string | null;
  transaction_nsu: string | null; paid_at: string | null; payment_note: string | null; refund_note: string | null;
  contact_deleted_at: string | null;
  whatsapp_opt_in: number;
  handoff_confirmed_at: string | null; handoff_attempts: number; handoff_locked_until: string | null; handoff_note: string | null;
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
        id text PRIMARY KEY NOT NULL, request_key text, request_hash text, created_at text NOT NULL, updated_at text NOT NULL,
        name text NOT NULL, phone text NOT NULL, email text, method text NOT NULL,
        neighborhood text, address text, notes text, items_json text NOT NULL,
        burger_count integer NOT NULL, subtotal integer NOT NULL, delivery_fee integer,
        total integer, status text NOT NULL, payment_mode text, checkout_url text,
        invoice_slug text, transaction_nsu text, paid_at text, payment_note text, refund_note text,
        contact_deleted_at text, whatsapp_opt_in integer NOT NULL DEFAULT 0, handoff_confirmed_at text,
        handoff_attempts integer NOT NULL DEFAULT 0, handoff_locked_until text, handoff_note text
      )`).run();
      const columns = await database.prepare("PRAGMA table_info(orders)").all<{name:string}>();
      if (!columns.results?.some(column => column.name === "request_key")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN request_key text").run();
      }
      if (!columns.results?.some(column => column.name === "request_hash")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN request_hash text").run();
      }
      await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_request_key ON orders(request_key)").run();
      if (!columns.results?.some(column => column.name === "email")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN email text").run();
      }
      if (!columns.results?.some(column => column.name === "payment_note")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN payment_note text").run();
      }
      if (!columns.results?.some(column => column.name === "contact_deleted_at")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN contact_deleted_at text").run();
      }
      if (!columns.results?.some(column => column.name === "whatsapp_opt_in")) {
        await database.prepare("ALTER TABLE orders ADD COLUMN whatsapp_opt_in integer NOT NULL DEFAULT 0").run();
      }
      for (const [name, definition] of [
        ["handoff_confirmed_at", "text"],
        ["handoff_attempts", "integer NOT NULL DEFAULT 0"],
        ["handoff_locked_until", "text"],
        ["handoff_note", "text"],
      ]) {
        if (!columns.results?.some(column => column.name === name)) {
          await database.prepare(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`).run();
        }
      }
      await database.prepare(`CREATE TABLE IF NOT EXISTS order_notifications (
        id text PRIMARY KEY NOT NULL, order_id text NOT NULL, event text NOT NULL,
        message text NOT NULL, state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
        next_attempt_at text, last_error text, accepted_at text, updated_at text NOT NULL,
        UNIQUE(order_id, event)
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS email_notifications (
        id text PRIMARY KEY NOT NULL, order_id text NOT NULL, event text NOT NULL,
        subject text NOT NULL, message text NOT NULL, state text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0, next_attempt_at text, last_error text,
        accepted_at text, updated_at text NOT NULL, UNIQUE(order_id, event)
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS settings (
        id integer PRIMARY KEY NOT NULL, capacity integer DEFAULT 100 NOT NULL,
        paused integer DEFAULT false NOT NULL
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS products (
        id text PRIMARY KEY NOT NULL, name text NOT NULL, description text NOT NULL,
        category text NOT NULL, price integer NOT NULL, image_url text, stock integer,
        active integer NOT NULL DEFAULT 1, sort_order integer NOT NULL DEFAULT 0,
        ingredients_json text NOT NULL DEFAULT '[]',
        created_at text NOT NULL, updated_at text NOT NULL
      )`).run();
      const productColumns = await database.prepare("PRAGMA table_info(products)").all<{name:string}>();
      if (!productColumns.results?.some(column => column.name === "stock")) {
        await database.prepare("ALTER TABLE products ADD COLUMN stock integer").run();
      }
      if (!productColumns.results?.some(column => column.name === "ingredients_json")) {
        await database.prepare("ALTER TABLE products ADD COLUMN ingredients_json text NOT NULL DEFAULT '[]'").run();
        await database.prepare("UPDATE products SET ingredients_json = ? WHERE id = 'classic'").bind(JSON.stringify(["Carne", "Queijo", "Alface", "Tomate", "Molho da casa"])).run();
        await database.prepare("DELETE FROM products WHERE id = 'bacon' AND name = 'Bacon' AND price = 2700 AND description = 'Carne, queijo, bacon crocante e molho da casa.' AND image_url = '/products/bacon.webp' AND stock IS NULL AND updated_at = created_at AND EXISTS (SELECT 1 FROM products WHERE id = 'classic' AND active = 1)").run();
        await database.prepare("UPDATE products SET active = 0 WHERE category = 'burger' AND active = 1 AND id NOT IN (SELECT id FROM products WHERE category = 'burger' AND active = 1 ORDER BY sort_order, created_at, id LIMIT 1)").run();
      }
      await database.prepare(`CREATE TABLE IF NOT EXISTS product_images (
        id text PRIMARY KEY NOT NULL, mime_type text NOT NULL, base64_data text NOT NULL
      )`).run();
      const existing = await database.prepare("SELECT COUNT(*) AS count FROM products").first<{count:number}>();
      if (!existing?.count) {
        const now = new Date().toISOString();
        for (const [index, product] of menu.entries()) {
          await database.prepare("INSERT OR IGNORE INTO products (id,name,description,category,price,image_url,active,sort_order,ingredients_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .bind(product.id,product.name,product.description,product.category,product.price,product.imageUrl,1,(index+1)*10,JSON.stringify(includesBurger(product) ? hamburgerIngredients : []),now,now).run();
        }
      }
      await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS one_active_burger ON products(category) WHERE category = 'burger' AND active = 1").run();
      await database.prepare("CREATE TABLE IF NOT EXISTS menu_revisions (id text PRIMARY KEY NOT NULL, applied_at text NOT NULL)").run();
      const revision = "event-menu-2026-10-v1";
      const applied = await database.prepare("SELECT id FROM menu_revisions WHERE id = ?").bind(revision).first();
      if (!applied) {
        const now = new Date().toISOString();
        const availableIds = menu.map(product => product.id);
        const pending = "NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)";
        await database.batch([
          database.prepare(`UPDATE products SET active = 0, updated_at = ? WHERE id NOT IN (${availableIds.map(() => "?").join(",")}) AND ${pending}`)
            .bind(now, ...availableIds, revision),
          ...menu.map((product, index) => database.prepare(`INSERT INTO products (id,name,description,category,price,image_url,active,sort_order,ingredients_json,created_at,updated_at)
            SELECT ?,?,?,?,?,?,1,?,?,?,? WHERE ${pending}
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,
              price=excluded.price,image_url=excluded.image_url,active=1,sort_order=excluded.sort_order,
              ingredients_json=excluded.ingredients_json,updated_at=excluded.updated_at`)
            .bind(product.id, product.name, product.description, product.category, product.price, product.imageUrl,
              (index + 1) * 10, JSON.stringify(includesBurger(product) ? hamburgerIngredients : []), now, now, revision)),
          database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(revision, now),
        ]);
      }
      const photoRevision = "combo-photo-2026-10-v1";
      await database.batch([
        database.prepare("UPDATE products SET image_url = ?, updated_at = ? WHERE id = 'combo' AND NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)")
          .bind("/products/combo-azul-v2.webp", new Date().toISOString(), photoRevision),
        database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(photoRevision, new Date().toISOString()),
      ]);
      const productPhotosRevision = "product-photos-2026-10-v1";
      await database.batch([
        ...menu.filter(product => ["fries-small", "coke", "coke-zero", "guarana"].includes(product.id)).map(product =>
          database.prepare("UPDATE products SET image_url = ?, updated_at = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)")
            .bind(product.imageUrl, new Date().toISOString(), product.id, productPhotosRevision)),
        database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(productPhotosRevision, new Date().toISOString()),
      ]);
      const burgerPhotoRevision = "burger-photo-2026-10-v1";
      await database.batch([
        database.prepare("UPDATE products SET image_url = ?, updated_at = ? WHERE id = 'classic' AND NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)")
          .bind("/products/hamburguer-solo-azul.webp", new Date().toISOString(), burgerPhotoRevision),
        database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(burgerPhotoRevision, new Date().toISOString()),
      ]);
      const sparklingRevision = "sparkling-water-2026-10-v1";
      const sparklingWater = menu.find(product => product.id === "sparkling-water")!;
      const combo = menu.find(product => product.id === "combo")!;
      const sparklingNow = new Date().toISOString();
      await database.batch([
        database.prepare(`INSERT OR IGNORE INTO products (id,name,description,category,price,image_url,active,sort_order,ingredients_json,created_at,updated_at)
          SELECT ?,?,?,'drink',?,?,1,80,'[]',?,? WHERE NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)`)
          .bind(sparklingWater.id, sparklingWater.name, sparklingWater.description, sparklingWater.price, sparklingWater.imageUrl, sparklingNow, sparklingNow, sparklingRevision),
        database.prepare("UPDATE products SET description = ?, updated_at = ? WHERE id = 'combo' AND NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)")
          .bind(combo.description, sparklingNow, sparklingRevision),
        database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(sparklingRevision, sparklingNow),
      ]);
      const waterPhotoRevision = "mineral-water-photo-2026-10-v1";
      const waterPhotoNow = new Date().toISOString();
      await database.batch([
        database.prepare("UPDATE products SET image_url = ?, updated_at = ? WHERE id = 'water' AND image_url IS NULL AND NOT EXISTS (SELECT 1 FROM menu_revisions WHERE id = ?)")
          .bind("/products/water.webp", waterPhotoNow, waterPhotoRevision),
        database.prepare("INSERT OR IGNORE INTO menu_revisions (id,applied_at) VALUES (?,?)").bind(waterPhotoRevision, waterPhotoNow),
      ]);
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
  price: number; image_url: string | null; stock: number | null; active: number; sort_order: number; ingredients_json: string;
};

export async function getProducts(includeInactive = false): Promise<Product[]> {
  await ensureSchema();
  const result = await db().prepare(`SELECT id,name,description,category,price,image_url,stock,active,sort_order,ingredients_json FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, created_at, id`).all<ProductRow>();
  return result.results.map(row => ({
    id: row.id, name: row.name, description: row.description, category: row.category,
    price: row.price, imageUrl: row.image_url, stock: row.stock, active: Boolean(row.active), sortOrder: row.sort_order, ingredients: JSON.parse(row.ingredients_json) as string[],
  }));
}

export function orderItems(order: Order): OrderItem[] {
  const saved = JSON.parse(order.items_json) as {id:string;quantity:number;name?:string;price?:number;removedIngredients?:string[];unitRemovals?:string[][];unitDrinks?:string[]}[];
  return saved.map(item => {
    const original = menu.find(product => product.id === item.id);
    return { id: item.id, quantity: item.quantity, name: item.name ?? original?.name ?? item.id, price: item.price ?? original?.price ?? 0, removedIngredients: item.removedIngredients ?? [], unitRemovals: item.unitRemovals, unitDrinks: item.unitDrinks };
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

const handoffMessage = (id: string) => new TextEncoder().encode(`blueckyardigans-handoff-v1:${id}`);

async function handoffKey() {
  if (!env.ADMIN_PASSWORD) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_PASSWORD), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
}

export async function handoffToken(id: string) {
  const key = await handoffKey();
  if (!key) return null;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, handoffMessage(id)));
  return Array.from(signature, byte => byte.toString(16).padStart(2,"0")).join("");
}

export async function handoffOnly(id: string, token: string | null) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const key = await handoffKey();
  if (!key) return false;
  const bytes = Uint8Array.from(token.match(/.{2}/g)!, part => parseInt(part,16));
  return crypto.subtle.verify("HMAC", key, bytes, handoffMessage(id));
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
