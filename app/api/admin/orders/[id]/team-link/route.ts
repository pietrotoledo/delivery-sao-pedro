import { adminOnly, getOrder, handoffToken, json } from "@/lib/store";

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  if (!await adminOnly(request)) return json({error: "Acesso restrito."}, 403);
  const {id} = await context.params;
  if (!await getOrder(id)) return json({error: "Pedido não encontrado."}, 404);
  const token = await handoffToken(id);
  if (!token) return json({error: "Acesso da equipe indisponível."}, 503);
  const requestUrl = new URL(request.url);
  const target = new URL(`/equipe/pedido/${encodeURIComponent(id)}`, requestUrl.origin);
  target.searchParams.set("token", token);
  if (requestUrl.searchParams.get("print") === "1") target.searchParams.set("print", "1");
  return new Response(null, {status: 302, headers: {
    Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
  }});
}
