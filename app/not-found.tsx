import type { Metadata } from "next";
import ErrorScreen from "@/components/error-screen";

export const metadata: Metadata = { title: "Página não encontrada | BLUECKYARDIGANS" };

export default function NotFound() {
  return <ErrorScreen code="404" title="Página não encontrada" message="O endereço que você abriu não existe ou mudou. Confira o link ou volte ao cardápio para fazer seu pedido." />;
}
