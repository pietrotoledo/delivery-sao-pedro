import Link from "next/link";

export default function LegalLinks() {
  return <nav className="legal-links" aria-label="Informações legais">
    <Link href="/privacidade">Privacidade e LGPD</Link>
    <Link href="/cookies">Cookies</Link>
    <Link href="/termos">Termos de compra</Link>
  </nav>;
}
