import { env } from "cloudflare:workers";

export const menu = [
  { id: "classic", name: "Clássico", price: 2200, category: "burger", description: "Carne, queijo, alface, tomate e molho da casa." },
  { id: "bacon", name: "Bacon", price: 2700, category: "burger", description: "Carne, queijo, bacon crocante e molho da casa." },
  { id: "fries-small", name: "Batata pequena", price: 800, category: "side", description: "Batata frita crocante · porção pequena." },
  { id: "fries-large", name: "Batata grande", price: 1200, category: "side", description: "Batata frita crocante · porção grande." },
  { id: "water", name: "Água mineral", price: 350, category: "drink", description: "Água mineral · unidade." },
  { id: "coke", name: "Coca-Cola", price: 600, category: "drink", description: "Lata 350 ml." },
  { id: "coke-zero", name: "Coca-Cola Zero", price: 600, category: "drink", description: "Lata 350 ml." },
] as const;

export type Order = {
  id: string; created_at: string; updated_at: string; name: string; phone: string;
  method: "pickup" | "delivery"; neighborhood: string | null; address: string | null;
  notes: string | null; items_json: string; burger_count: number; subtotal: number;
  delivery_fee: number | null; total: number | null; status: string;
  payment_mode: string | null; checkout_url: string | null; invoice_slug: string | null;
  transaction_nsu: string | null; paid_at: string | null; refund_note: string | null;
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
        name text NOT NULL, phone text NOT NULL, method text NOT NULL,
        neighborhood text, address text, notes text, items_json text NOT NULL,
        burger_count integer NOT NULL, subtotal integer NOT NULL, delivery_fee integer,
        total integer, status text NOT NULL, payment_mode text, checkout_url text,
        invoice_slug text, transaction_nsu text, paid_at text, refund_note text
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS settings (
        id integer PRIMARY KEY NOT NULL, capacity integer DEFAULT 100 NOT NULL,
        paused integer DEFAULT false NOT NULL
      )`).run();
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export function paymentHandle() { return env.INFINITEPAY_HANDLE?.trim() || ""; }

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
    notes: order.notes, items: JSON.parse(order.items_json), burgerCount: order.burger_count,
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
  // In the owner-private demo, authenticated Site visitors can manage orders.
  // Real payments require ADMIN_PASSWORD before this dashboard is enabled.
  return !paymentHandle() && Boolean(request.headers.get("oai-authenticated-user-id"));
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
