import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./event-pause.css";
import "./legal.css";
import "./quintal.css";
import "./admin-bi.css";
import "./admin-panel.css";
import LegalLinks from "@/components/legal-links";
import PrivacyNotice from "@/components/privacy-notice";

export const metadata: Metadata = {
  title: "BLUECKYARDIGANS | Noite do Hambúrguer",
  description: "Noite do Hambúrguer Blueckyardigans. Entregas a partir das 19h e retirada no Edifício Valle Verzasca, R. Manoel Bezerra Cavalcanti, 65 - Manaíra, João Pessoa - PB, das 18h às 22h. Uma iniciativa do EJC da Igreja São Pedro Pescador.",
  icons: { icon: "/mascote.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#071b50",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PrivacyNotice />{children}<LegalLinks /></body></html>;
}
