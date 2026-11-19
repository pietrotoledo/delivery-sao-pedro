import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./event-pause.css";
import "./legal.css";
import LegalLinks from "@/components/legal-links";
import PrivacyNotice from "@/components/privacy-notice";

export const metadata: Metadata = {
  title: "BLUECKYARDIGANS | Noite do Hambúrguer",
  description: "A próxima Noite do Hambúrguer BLUECKYARDIGANS será na primeira semana de dezembro de 2026. Vendas encerradas por enquanto; pedidos voltam no final de novembro de 2026. Uma iniciativa do EJC da Igreja São Pedro Pescador.",
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
