import { json, loginSession, sameOrigin } from "@/lib/store";
import { adminSessionLifetime } from "@/lib/admin-session";
import { allowLogin, loginLimited } from "@/lib/login-limit";

export async function POST(request:Request) {
  if (!sameOrigin(request)) return json({error:"Origem inválida."},403);
  if (!await allowLogin(request, "admin")) return loginLimited();
  let body: { password?: unknown };
  try { body = await request.json() as { password?: unknown }; }
  catch { return json({error:"Dados inválidos."},400); }
  if (!body || typeof body.password !== "string" || body.password.length > 1024) return json({error:"Informe uma senha válida."},400);
  const token=await loginSession(body.password);
  if (!token) return json({error:"Senha inválida."},403);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ok:true},{headers:{"Set-Cookie":`blueck_admin=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${adminSessionLifetime}`,"Cache-Control":"no-store"}});
}
