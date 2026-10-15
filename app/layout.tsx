import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "BLUECKYARDIGANS | Noite do Hambúrguer",
  description: "Noite do Hambúrguer Blueckyardigans em 30 de outubro de 2026. Entregas a partir das 19h e retirada no Evidence Class Club, R. Pfa. Eudesia Vieira, 159 - Estados, João Pessoa - PB, das 18h às 22h.",
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
  return <html lang="pt-BR"><body>{children}</body></html>;
}
