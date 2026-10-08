import { db, ensureSchema } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  await ensureSchema();
  const image = await db().prepare("SELECT mime_type,base64_data FROM product_images WHERE id = ?")
    .bind(id).first<{ mime_type: string; base64_data: string }>();
  if (!image) return new Response(null, { status: 404 });
  const binary = atob(image.base64_data);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Response(bytes, { headers: { "Content-Type": image.mime_type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
