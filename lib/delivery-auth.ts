import { env } from "cloudflare:workers";

const lifetimeSeconds = 12 * 60 * 60;
const encoder = new TextEncoder();

async function key() {
  const secret = env.DELIVERY_PASSWORD?.trim();
  if (!secret || secret.length < 12) return null;
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function message(issuedAt: number) {
  return encoder.encode(`blueckyardigans-delivery-v1:${issuedAt}`);
}

export function deliveryAccessConfigured() {
  return Boolean(env.DELIVERY_PASSWORD?.trim() && env.DELIVERY_PASSWORD.trim().length >= 12);
}

export async function createDeliverySession(password: string) {
  const secret = env.DELIVERY_PASSWORD?.trim();
  if (!secret || secret.length < 12 || password !== secret) return null;
  const sessionKey = await key();
  if (!sessionKey) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", sessionKey, message(issuedAt)));
  return `${issuedAt}.${Array.from(signature, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function deliveryOnly(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.match(/(?:^|; )blueck_delivery=(\d{10})\.([a-f0-9]{64})(?:;|$)/);
  if (!token) return false;
  const issuedAt = Number(token[1]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(issuedAt) || issuedAt > now || now - issuedAt > lifetimeSeconds) return false;
  const sessionKey = await key();
  if (!sessionKey) return false;
  const signature = Uint8Array.from(token[2].match(/.{2}/g)!, part => parseInt(part, 16));
  return crypto.subtle.verify("HMAC", sessionKey, signature, message(issuedAt));
}

export function deliveryCookie(request: Request, session: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `blueck_delivery=${session}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${lifetimeSeconds}`;
}
