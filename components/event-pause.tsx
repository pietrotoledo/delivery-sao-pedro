import Image from "next/image";
import Link from "next/link";
import { ArrowDown, CalendarDays, Heart, ShoppingBag } from "lucide-react";
import BrandAvatar from "./brand-avatar";

export default function EventPause() {
  return <div className="event-pause-page">
    <header className="wrap event-pause-header"><Link className="brand" href="/" aria-label="BLUECKYARDIGANS, início"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link><span className="event-pause-label">Uma pausa entre encontros</span></header>
    <main className="wrap event-pause-main">
      <section className="event-pause-hero" aria-labelledby="event-pause-title">
        <div className="event-pause-copy">
          <span className="event-pause-badge"><span /> Vendas encerradas por enquanto</span>
          <h1 id="event-pause-title">A chapa está<br />descansando.<br /><em>A saudade, não!</em></h1>
          <p>A última noite deixou aquele gostinho de quero mais. Estamos preparando o próximo encontro — e você já tem lugar nessa mesa!</p>
          <a href="#proxima-noite" className="button button-yellow">Veja quando a gente volta <ArrowDown size={18} aria-hidden="true" /></a>
          <span className="event-pause-note">Os pedidos estão fechados. Logo tem mais!</span>
        </div>
        <div className="event-pause-art"><div className="event-pause-orbit" aria-hidden="true" /><Image src="/products/combo-azul-v2.webp" width={720} height={720} priority alt="Hambúrguer artesanal, batata frita e bebida do Blueck Combo" /><div className="event-pause-sticker">A gente volta<br /><strong>em dezembro!</strong><Heart size={22} aria-hidden="true" /></div></div>
      </section>
      <section className="event-pause-next" id="proxima-noite" aria-labelledby="event-next-title">
        <div className="event-pause-next-heading"><span>ANOTA AÍ</span><h2 id="event-next-title">O próximo encontro já está no radar.</h2></div>
        <div className="event-pause-dates"><article><span className="event-pause-icon"><ShoppingBag size={24} aria-hidden="true" /></span><div><p>Abertura dos pedidos</p><h3>Final de novembro</h3><span>2026 · Falta pouco para garantir o seu.</span></div></article><article><span className="event-pause-icon"><CalendarDays size={24} aria-hidden="true" /></span><div><p>Próxima Noite do Hambúrguer</p><h3>Primeira semana de dezembro</h3><span>2026 · Mais sabor e todo mundo junto.</span></div></article></div>
        <p className="event-pause-details">A data exata e os horários serão divulgados em breve. Fique de olho por aqui!</p>
      </section>
    </main>
    <footer className="wrap event-pause-footer"><span>BLUECKYARDIGANS</span><p>Feito com carinho pelo EJC da Igreja São Pedro Pescador.</p><Heart size={18} aria-hidden="true" /></footer>
  </div>;
}
