import { json, sameOrigin } from "@/lib/store";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `blueck_delivery=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`, "Cache-Control": "no-store" } });
}
