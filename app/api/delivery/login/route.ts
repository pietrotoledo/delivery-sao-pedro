import { createDeliverySession, deliveryAccessConfigured, deliveryCookie } from "@/lib/delivery-auth";
import { json, sameOrigin } from "@/lib/store";
import { allowLogin, loginLimited } from "@/lib/login-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  if (!deliveryAccessConfigured()) return json({ error: "A senha dos entregadores ainda não foi configurada." }, 503);
  if (!await allowLogin(request, "delivery")) return loginLimited();
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; }
  catch { return json({ error: "Informe a senha dos entregadores." }, 400); }
  if (!body || typeof body.password !== "string" || body.password.length > 1024) return json({ error: "Informe uma senha válida." }, 400);
  const session = await createDeliverySession(body.password);
  if (!session) return json({ error: "Senha inválida." }, 403);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": deliveryCookie(request, session), "Cache-Control": "no-store" } });
}
