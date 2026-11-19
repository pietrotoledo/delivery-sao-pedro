export function secureResponse(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const url = new URL(request.url);
  if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000");
  if (/^\/(?:api|admin|pedido|equipe|entregas)(?:\/|$)/.test(url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
    // Fotos públicas têm IDs próprios e podem continuar usando o cache existente.
    if (!url.pathname.startsWith("/api/products/images/") && !headers.get("Cache-Control")?.includes("no-store")) headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
