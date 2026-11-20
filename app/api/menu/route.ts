import { getProducts } from "@/lib/store";

// Consulta pública sem rotinas de pedidos, pagamentos ou atualização de estoque.
export async function GET() {
  const products = (await getProducts()).map(({ id, name, description, category, price, imageUrl }) => ({ id, name, description, category, price, imageUrl }));
  return Response.json({ products }, { headers: { "Cache-Control": "public, max-age=60" } });
}
