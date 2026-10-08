export function productPhoto(product: { imageUrl?: string | null; category: string }) {
  if (product.imageUrl) return product.imageUrl;
  if (product.category === "drink") return "/products/water.webp";
  if (product.category === "side") return "/products/fries-small.webp";
  return "/products/classic.webp";
}

export function externalPhoto(src: string) {
  return src.startsWith("https://") || src.startsWith("/api/products/images/");
}
