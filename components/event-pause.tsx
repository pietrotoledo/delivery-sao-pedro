import Image from "next/image";
import Link from "next/link";
import { Heart, ArrowDown } from "lucide-react";
import BrandAvatar from "./brand-avatar";
import PausedMenu from "./paused-menu";

function PosterStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><path d="m32 0 5.8 19.4L54.6 9.4l-10 16.8L64 32l-19.4 5.8 10 16.8-16.8-10L32 64l-5.8-19.4-16.8 10 10-16.8L0 32l19.4-5.8-10-16.8 16.8 10Z" /></svg>;
}

export default function EventPause() {
  return <div className="return-poster">
    <header className="poster-header poster-wrap">
      <Link className="poster-brand" href="/" aria-label="BLUECKYARDIGANS, início"><BrandAvatar /><span>BLUECKYARDIGANS</span></Link>
      <span className="poster-status"><span aria-hidden="true" />Pedidos em pausa.<br /><strong>O carinho continua.</strong></span>
    </header>
    <main>
      <div className="poster-wrap">
      <section className="poster-hero" aria-labelledby="return-title">
        <div className="poster-copy">
          <p className="poster-event">Noite do Hambúrguer</p>
          <h1 id="return-title"><span>Segura a fome.</span><span>A gente já volta.</span></h1>
          <p className="poster-intro">A chapa deu uma pausa.<br />Os encontros bons, a gente repete.</p>
          <p className="poster-description">Estamos preparando a próxima noite do EJC, com hambúrguer caprichado e todo mundo junto outra vez.</p>
          <p className="poster-closed">As vendas estão encerradas por enquanto.<br /><strong>Pedidos de volta na última semana de novembro.</strong></p>
          <a className="poster-menu-link" href="#cardapio">Enquanto isso, vem ver o cardápio <ArrowDown size={18} aria-hidden="true" /></a>
        </div>
        <div className="poster-art">
          <PosterStar className="poster-star poster-star-one" />
          <div className="poster-photo"><Image src="/mascote.png" width={640} height={640} priority sizes="(max-width: 760px) 90vw, 45vw" alt="Nosso mascote azul de boné colorido, pronto para a próxima Noite do Hambúrguer" /></div>
          <div className="poster-seal"><span>É só uma pausa!</span><strong>Já já<br />tô de volta.</strong><Heart size={20} aria-hidden="true" /></div>
          <PosterStar className="poster-star poster-star-two" />
          <p className="poster-art-note">feito pra reunir.</p>
        </div>
      </section>
      <section className="poster-ticket" aria-labelledby="return-dates-title">
        <div className="poster-ticket-title"><h2 id="return-dates-title">Seu próximo<br /> encontro com a gente.</h2><span>Novembro / Dezembro 2026</span></div>
        <dl className="poster-dates"><div><dt>Os pedidos voltam na</dt><dd>última semana<br />de novembro<span>de 2026</span></dd></div><div><dt>A próxima noite será na</dt><dd>primeira semana<br />de dezembro<span>de 2026</span></dd></div></dl>
      </section>
      <p className="poster-fineprint">A data exata e os horários serão divulgados em breve. Fique de olho por aqui!</p>
      </div>
      <PausedMenu />
    </main>
    <footer className="poster-footer poster-wrap"><p>Uma noite de sabor.<br /><strong>Um encontro de verdade.</strong></p><span>EJC · Igreja São Pedro Pescador<Heart size={16} aria-hidden="true" /></span></footer>
  </div>;
}
