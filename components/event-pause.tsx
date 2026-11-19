import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";

function PosterStar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><path d="m32 0 5.8 19.4L54.6 9.4l-10 16.8L64 32l-19.4 5.8 10 16.8-16.8-10L32 64l-5.8-19.4-16.8 10 10-16.8L0 32l19.4-5.8-10-16.8 16.8 10Z" /></svg>;
}

export default function EventPause() {
  return <div className="return-poster">
    <header className="poster-header poster-wrap">
      <Link className="poster-brand" href="/" aria-label="BLUECKYARDIGANS, início"><PosterStar /><span>BLUECKYARDIGANS</span></Link>
      <span className="poster-status"><span aria-hidden="true" />Pedidos em pausa.<br /><strong>O carinho continua.</strong></span>
    </header>
    <main className="poster-wrap">
      <section className="poster-hero" aria-labelledby="return-title">
        <div className="poster-copy">
          <p className="poster-event">Noite do Hambúrguer</p>
          <h1 id="return-title"><span>Deu saudade?</span><span>Já já tem mais.</span></h1>
          <p className="poster-intro">A chapa deu uma pausa.<br />Os encontros bons, a gente repete.</p>
          <p className="poster-description">Estamos preparando a próxima noite do EJC, com hambúrguer caprichado e todo mundo junto outra vez.</p>
          <p className="poster-closed">As vendas estão encerradas por enquanto.<br /><strong>Guarda essas datas e prepara o apetite!</strong></p>
        </div>
        <div className="poster-art">
          <PosterStar className="poster-star poster-star-one" />
          <div className="poster-photo"><Image src="/products/hamburguer-solo-azul.webp" width={640} height={640} priority sizes="(max-width: 760px) 90vw, 45vw" alt="Hambúrguer artesanal com queijo e cebola caramelizada, em um cenário azul com nuvens" /></div>
          <div className="poster-seal"><span>Nosso próximo</span><strong>encontro<br />tem sabor.</strong><Heart size={20} aria-hidden="true" /></div>
          <PosterStar className="poster-star poster-star-two" />
          <p className="poster-art-note">feito pra reunir.</p>
        </div>
      </section>
      <section className="poster-ticket" aria-labelledby="return-dates-title">
        <div className="poster-ticket-title"><h2 id="return-dates-title">Seu próximo<br /> encontro com a gente.</h2><span>Novembro / Dezembro 2026</span></div>
        <dl className="poster-dates"><div><dt>Os pedidos voltam no</dt><dd>final de novembro<span>de 2026</span></dd></div><div><dt>A próxima noite será na</dt><dd>primeira semana<br />de dezembro<span>de 2026</span></dd></div></dl>
      </section>
      <p className="poster-fineprint">A data exata e os horários serão divulgados em breve. Fique de olho por aqui!</p>
    </main>
    <footer className="poster-footer poster-wrap"><p>Uma noite de sabor.<br /><strong>Um encontro de verdade.</strong></p><span>EJC · Igreja São Pedro Pescador<Heart size={16} aria-hidden="true" /></span></footer>
  </div>;
}
