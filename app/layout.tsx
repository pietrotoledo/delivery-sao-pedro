import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./legal.css";
import LegalLinks from "@/components/legal-links";
import PrivacyNotice from "@/components/privacy-notice";

export const metadata: Metadata = {
  title: "BLUECKYARDIGANS | Noite do Hambúrguer",
  description: "Noite do Hambúrguer Blueckyardigans em 30 de outubro de 2026. Entregas a partir das 19h e retirada na Casa Branca de Esquina, Rua Francisco Claudino Pereira, 885 - Manaíra, João Pessoa - PB, das 18h às 22h.",
  icons: { icon: "/mascote.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PrivacyNotice />{children}<LegalLinks /></body></html>;
}
