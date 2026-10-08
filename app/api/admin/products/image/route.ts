import { adminOnly, db, ensureSchema, json, sameOrigin } from "@/lib/store";

const maxSize = 900_000;
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  "image/webp": bytes => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  "image/avif": bytes => String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif"),
};

export async function POST(request: Request) {
  if (!await adminOnly(request) || !sameOrigin(request)) return json({ error: "Acesso restrito." }, 403);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "Arquivo inválido." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || !signatures[file.type] || !file.size || file.size > maxSize) {
    return json({ error: "Envie JPG, PNG, WebP ou AVIF com até 900 KB." }, 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatures[file.type](bytes)) return json({ error: "O formato da imagem não corresponde ao arquivo." }, 400);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.slice(index, index + 8192));
  const id = crypto.randomUUID();
  await ensureSchema();
  await db().prepare("INSERT INTO product_images (id,mime_type,base64_data) VALUES (?,?,?)")
    .bind(id, file.type, btoa(binary)).run();
  return json({ imageUrl: `/api/products/images/${id}` }, 201);
}
