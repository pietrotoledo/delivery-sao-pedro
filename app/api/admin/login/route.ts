import { json, loginSession, sameOrigin } from "@/lib/store";

export async function POST(request:Request) {
  if (!sameOrigin(request)) return json({error:"Origem inválida."},403);
  const body=await request.json() as {password?:string};
  const token=await loginSession(String(body.password||""));
  if (!token) return json({error:"Senha inválida."},403);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ok:true},{headers:{"Set-Cookie":`blueck_admin=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=604800`,"Cache-Control":"no-store"}});
}
