"use client";

import Link from "next/link";
import { X } from "lucide-react";
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

  return <aside className="privacy-notice" aria-label="Privacidade e armazenamento no navegador">
    <p>Usamos cookies e armazenamento essenciais para o site funcionar. <Link href="/cookies">Cookies</Link> e <Link href="/privacidade">privacidade</Link>.</p>
    <button type="button" onClick={dismiss} aria-label="Fechar aviso de privacidade" title="Fechar aviso"><X size={16} aria-hidden="true" /></button>
  </aside>;
}
