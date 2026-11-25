import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import { defaultStoreWhatsapp, phoneLabel } from "@/lib/store-contact";

export default function ErrorScreen({ code, title, message, action }: { code: string; title: string; message: string; action?: ReactNode }) {
  const whatsapp = `https://wa.me/${defaultStoreWhatsapp}?text=${encodeURIComponent("Olá! Tive um problema no site da Noite do Hambúrguer.")}`;
  return <div className="error-page">
    <header className="error-topbar wrap"><Link className="brand" href="/"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link></header>
    <main className="error-wrap">
      <div className="error-hero" aria-hidden="true"><p className="error-code">{code}</p><Image className="error-pablo" src="/pablo/pablo-olhando.webp" width={167} height={280} sizes="120px" alt="" /></div>
      <h1>{title}</h1>
      <p className="error-message">{message}</p>
      <div className="error-actions">
        {action}
        <Link className="button button-yellow" href="/">Voltar ao cardápio</Link>
      </div>
      <a className="error-help" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" /> Precisa de ajuda? Fale com a gente no WhatsApp <strong>{phoneLabel(defaultStoreWhatsapp)}</strong></a>
    </main>
  </div>;
}
