import { adminOnly, db, ensureSchema, json, type Order } from "@/lib/store";

type ContactOrder = Pick<Order,
  "id" | "created_at" | "name" | "phone" | "email" | "method" |
  "neighborhood" | "address" | "subtotal" | "delivery_fee" | "total" |
  "status" | "checkout_url" | "paid_at"
>;

const columns = "id,created_at,name,phone,email,method,neighborhood,address,subtotal,delivery_fee,total,status,checkout_url,paid_at";

export async function GET(request: Request) {
  if (!await adminOnly(request)) return json({ error: "Acesso restrito." }, 403);
  await ensureSchema();
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const requestedPage = Number(url.searchParams.get("page") ?? 0);
  const page = Number.isInteger(requestedPage) ? Math.max(0, Math.min(100000, requestedPage)) : 0;
  const where = search ? "WHERE contact_deleted_at IS NULL AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR id LIKE ?)" : "WHERE contact_deleted_at IS NULL";
  const pattern = `%${search}%`;
  const values = search ? [pattern, pattern, pattern, pattern] : [];
  const countQuery = db().prepare(`SELECT COUNT(*) AS count FROM orders ${where}`);
  const listQuery = db().prepare(`SELECT ${columns} FROM orders ${where} ORDER BY created_at DESC,id DESC LIMIT 100 OFFSET ?`);
  const [count, result] = await Promise.all([
    (search ? countQuery.bind(...values) : countQuery).first<{count:number}>(),
    listQuery.bind(...values, page * 100).all<ContactOrder>(),
  ]);
  return json({ orders: result.results, total: count?.count ?? 0, page });
}
