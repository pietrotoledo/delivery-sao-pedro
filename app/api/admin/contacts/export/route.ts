import { adminOnly, db, ensureSchema, orderItems, type Order } from "@/lib/store";

function csvCell(value: unknown) {
  let cell = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^\s*[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!await adminOnly(request)) return Response.json({ error: "Acesso restrito." }, { status: 403 });
  await ensureSchema();
  const headers = ["Código", "ID do pedido", "Criado em", "Nome", "WhatsApp", "E-mail", "Recebimento", "Bairro", "Endereço", "Itens", "Status", "Subtotal (R$)", "Taxa de entrega (R$)", "Total (R$)", "Link do pedido", "Link Pix", "Pago em"];
  const lines = [headers.map(csvCell).join(";")];
  const origin = new URL(request.url).origin;
  let offset = 0;
  for (;;) {
    const batch = await db().prepare("SELECT * FROM orders WHERE contact_deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 500 OFFSET ?").bind(offset).all<Order>();
    for (const order of batch.results) {
      const row = [
        order.id.slice(0, 8).toUpperCase(), order.id, order.created_at,
        order.name, order.phone, order.email, order.method === "delivery" ? "Entrega" : "Retirada",
        order.neighborhood, order.address,
        orderItems(order).map(item => `${item.quantity}x ${item.name}${item.removedIngredients?.length ? ` (sem ${item.removedIngredients.join(", ")})` : ""}`).join(" | "),
        order.status, (order.subtotal / 100).toFixed(2).replace(".", ","),
        order.delivery_fee === null ? "" : (order.delivery_fee / 100).toFixed(2).replace(".", ","),
        order.total === null ? "" : (order.total / 100).toFixed(2).replace(".", ","),
        `${origin}/pedido/${order.id}`, order.paid_at || order.status === "refunded" ? "" : order.checkout_url, order.paid_at,
      ];
      lines.push(row.map(csvCell).join(";"));
    }
    if (batch.results.length < 500) break;
    offset += 500;
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-contatos-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
