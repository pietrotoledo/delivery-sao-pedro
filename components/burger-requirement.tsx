"use client";

import { useEffect, useRef, type MouseEventHandler } from "react";
import { ShoppingBag } from "lucide-react";

export function focusBurgerRequirement() {
  window.requestAnimationFrame(() => {
    const link = document.querySelector<HTMLElement>("#burger-requirement a");
    link?.focus({ preventScroll: true });
    link?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  });
}

export function LastBurgerDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <dialog ref={dialog} className="last-burger-dialog" aria-labelledby="last-burger-title" aria-describedby="last-burger-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="last-burger-icon"><ShoppingBag size={24} aria-hidden="true" /></div>
    <h2 id="last-burger-title">Retirar o último hambúrguer?</h2>
    <p id="last-burger-description">Para finalizar o pedido, é necessário incluir pelo menos um hambúrguer, avulso ou no combo. Se retirar agora, você precisará adicionar outro antes de seguir para o pagamento.</p>
    <div className="last-burger-actions">
      <button type="button" className="button button-yellow" onClick={onCancel}>Manter no pedido</button>
      <button type="button" className="last-burger-remove" onClick={onConfirm}>Retirar mesmo assim</button>
    </div>
  </dialog>;
}

export function BurgerRequirementNotice({ href, onChoose }: { href: string; onChoose?: MouseEventHandler<HTMLAnchorElement> }) {
  return <div className="burger-requirement" id="burger-requirement" role="status">
    <strong>Falta um hambúrguer no seu pedido</strong>
    <p>Bebidas, batatas e docinhos devem acompanhar pelo menos um hambúrguer, avulso ou no combo.</p>
    <a href={href} onClick={onChoose}>Adicionar hambúrguer</a>
  </div>;
}
