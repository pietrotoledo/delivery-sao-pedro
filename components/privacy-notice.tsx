"use client";

import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const noticeKey = "blueckyardigans-privacy-notice-v1";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("focus", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("focus", notify);
  };
};
function wasRead() {
  try {
    return document.cookie.split(";").some(cookie => cookie.trim() === `${noticeKey}=read`)
      || window.localStorage.getItem(noticeKey) === "read";
  }
  catch { return false; }
}

export default function PrivacyNotice() {
  const stored = useSyncExternalStore(subscribe, wasRead, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;

  function dismiss() {
    try {
      document.cookie = `${noticeKey}=read; Path=/; Max-Age=15552000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
      window.localStorage.removeItem(noticeKey);
    } catch { /* O aviso pode ser fechado mesmo sem armazenamento. */ }
    setDismissed(true);
  }

  return <aside className="privacy-notice" aria-labelledby="privacy-notice-title">
    <div className="privacy-notice-head">
      <span className="privacy-notice-icon" aria-hidden="true"><Cookie size={18} /></span>
      <h2 id="privacy-notice-title">Cookies essenciais</h2>
      <button type="button" className="privacy-notice-close" onClick={dismiss} aria-label="Fechar aviso de cookies" title="Fechar"><X size={16} aria-hidden="true" /></button>
    </div>
    <p>Usamos apenas cookies e armazenamento necessários para o carrinho e o pedido funcionarem. Nada de anúncios ou rastreamento.</p>
    <div className="privacy-notice-actions">
      <button type="button" className="privacy-notice-ok" onClick={dismiss}>Entendi</button>
      <Link href="/cookies">Política de cookies</Link>
      <Link href="/privacidade">Privacidade</Link>
    </div>
  </aside>;
}
