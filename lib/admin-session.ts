export const adminSessionLifetime = 12 * 60 * 60;
const encoder = new TextEncoder();
const message = (value: string) => encoder.encode(`blueckyardigans-admin-v2:${value}`);
const sessionKey = (secret: string) => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function createAdminSession(secret: string) {
  const payload = `${Math.floor(Date.now() / 1000)}.${crypto.randomUUID()}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await sessionKey(secret), message(payload)));
  return `${payload}.${Array.from(signature, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyAdminSession(token: string, secret: string) {
  const match = /^(\d{10})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/.exec(token);
  if (!match || !secret) return false;
  const age = Math.floor(Date.now() / 1000) - Number(match[1]);
  if (age < 0 || age >= adminSessionLifetime) return false;
  const signature = Uint8Array.from(match[3].match(/.{2}/g)!, byte => parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", await sessionKey(secret), signature, message(`${match[1]}.${match[2]}`));
}
