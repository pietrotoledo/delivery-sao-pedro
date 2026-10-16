"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const noticeKey = "blueckyardigans-privacy-notice-v1";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};
function wasRead() {
  try { return window.localStorage.getItem(noticeKey) === "read"; }
  catch { return false; }
}

export default function PrivacyNotice() {
  const stored = useSyncExternalStore(subscribe, wasRead, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;

  function dismiss() {
    try { window.localStorage.setItem(noticeKey, "read"); } catch { /* O aviso pode ser fechado mesmo sem armazenamento. */ }
    setDismissed(true);
  }

  return <aside className="privacy-notice" aria-label="Privacidade e armazenamento no navegador">
    <div><strong>Sua privacidade</strong><p>Usamos armazenamento essencial para o carrinho, os pedidos e o acesso da equipe. Esta versão não inclui cookies de publicidade ou análise de navegação. <Link href="/cookies">Saiba mais sobre cookies</Link> e <Link href="/privacidade">seus dados</Link>.</p></div>
    <button type="button" onClick={dismiss}>Entendi</button>
  </aside>;
}
