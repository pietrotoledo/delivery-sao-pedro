import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className="legal-page">
    <header className="wrap legal-header"><Link className="brand" href="/">BLUECKYARDIGANS</Link><Link href="/">Voltar ao cardápio</Link></header>
    <main className="legal-content">
      <p className="section-kicker">Informações para você</p>
      <h1>{title}</h1><p className="legal-intro">{intro}</p>
      <p className="legal-updated">Atualizado em 16 de outubro de 2026.</p>
      {children}
    </main>
  </div>;
}
