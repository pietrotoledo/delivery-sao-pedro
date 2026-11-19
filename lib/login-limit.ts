import { db } from "./store";

const windowSeconds = 600;
let ready: Promise<unknown> | undefined;

// Contagem atômica no D1: tentativas em Workers diferentes compartilham o limite.
export async function allowLogin(request: Request, scope: "admin" | "delivery") {
  ready ??= db().prepare("CREATE TABLE IF NOT EXISTS login_attempts (id TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL)").run().catch(error => { ready = undefined; throw error; });
  await ready;
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address)));
  const id = `${scope}:${Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")}`;
  const window = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const result = await db().prepare(`INSERT INTO login_attempts (id,window_start,attempts) VALUES (?,?,1)
    ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,
    window_start=excluded.window_start RETURNING attempts`).bind(id, window).first<{attempts: number}>();
  return Boolean(result && result.attempts <= 10);
}

export function loginLimited() {
  return Response.json({ error: "Muitas tentativas de acesso. Aguarde 10 minutos e tente novamente." }, {
    status: 429, headers: { "Retry-After": String(windowSeconds), "Cache-Control": "no-store" },
  });
}
