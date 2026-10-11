import { createDeliverySession, deliveryAccessConfigured, deliveryCookie } from "@/lib/delivery-auth";
import { json, sameOrigin } from "@/lib/store";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  if (!deliveryAccessConfigured()) return json({ error: "A senha dos entregadores ainda não foi configurada." }, 503);
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; }
  catch { return json({ error: "Informe a senha dos entregadores." }, 400); }
  const session = await createDeliverySession(String(body.password ?? ""));
  if (!session) return json({ error: "Senha inválida." }, 403);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": deliveryCookie(request, session), "Cache-Control": "no-store" } });
}
