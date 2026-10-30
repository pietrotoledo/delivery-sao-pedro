import { deliveryOnly } from "@/lib/delivery-auth";
import { adminOnly, db, ensureSchema, json } from "@/lib/store";
import { ensureDeliveryRouteSchema } from "@/lib/delivery-route-assignments";

// Consulta compartilhada ao D1: funciona entre celulares e instâncias diferentes do Worker.
async function revision() {
  const rows = await db().prepare(`SELECT o.id,o.updated_at,o.status,o.paid_at,o.contact_deleted_at,
    ro.route_id,ro.position,r.driver_name,r.released_at
    FROM orders o LEFT JOIN delivery_route_orders ro ON ro.order_id=o.id
    LEFT JOIN delivery_routes r ON r.id=ro.route_id WHERE o.method='delivery' ORDER BY o.id`).all();
  return JSON.stringify(rows.results);
}

export async function GET(request: Request) {
  if (!await deliveryOnly(request) && !await adminOnly(request)) return json({ error: "Acesso restrito à equipe." }, 403);
  await ensureSchema();
  await ensureDeliveryRouteSchema();
  let previous = await revision();
  let dispose = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false, checking = false, ticks = 0;
      const close = () => { if (!closed) { dispose(); controller.close(); } };
      const tick = async () => {
        if (closed || checking) return;
        checking = true;
        try {
          const current = await revision();
          if (closed) return;
          if (current !== previous) {
            previous = current;
            controller.enqueue(encoder.encode("event: sync\ndata: {}\n\n"));
          } else if (++ticks % 15 === 0) controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch { close(); }
        finally { checking = false; }
      };
      const interval = setInterval(() => { void tick(); }, 1000);
      // Reconectar revalida a sessão, incluindo expiração e logout.
      const lifetime = setTimeout(close, 25000);
      dispose = () => { closed = true; clearInterval(interval); clearTimeout(lifetime); request.signal.removeEventListener("abort", close); };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 1000\nevent: sync\ndata: {}\n\n"));
      if (request.signal.aborted) close();
    },
    cancel() { dispose(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
