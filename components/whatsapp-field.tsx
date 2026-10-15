"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { brazilianMobileError, formatBrazilianMobile } from "@/lib/phone";

export default function WhatsAppField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (selectionRef.current !== null) {
      inputRef.current?.setSelectionRange(selectionRef.current, selectionRef.current);
      selectionRef.current = null;
    }
  }, [value]);

  function validate(input: HTMLInputElement) {
    const message = brazilianMobileError(input.value);
    input.setCustomValidity(message ?? "");
    setError(message);
  }

  return <label htmlFor="checkout-phone">Celular com DDD (WhatsApp)
    <input ref={inputRef} id="checkout-phone" name="phone" type="tel" value={value} autoComplete="tel" inputMode="tel"
      placeholder="(83) 99912-3456" required maxLength={32}
      aria-invalid={Boolean(error) || undefined} aria-describedby={`checkout-phone-help${error ? " checkout-phone-error" : ""}`}

      onChange={event => {
        const raw = event.target.value;
        // Leave deletions alone so backspace never gets stuck on a separator.
        const deleting = (event.nativeEvent as InputEvent).inputType?.startsWith("delete");
        const formatted = deleting ? raw : formatBrazilianMobile(raw);
        const digitsBeforeCursor = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/\D/g, "").length;
        if (formatted !== value) {
          let cursor = 0;
          let digits = 0;
          while (cursor < formatted.length && digits < digitsBeforeCursor) {
            if (/\d/.test(formatted[cursor])) digits++;
            cursor++;
          }
          selectionRef.current = cursor;
        }
        event.currentTarget.setCustomValidity(brazilianMobileError(formatted) ?? "");
        setError(null);
        onChange(formatted);
      }}
      onBlur={event => validate(event.currentTarget)} onInvalid={event => validate(event.currentTarget)} />
    <small id="checkout-phone-help">Digite 11 números: 2 do DDD + 9 do celular. Pode colar com +55.</small>
    {error && <small id="checkout-phone-error" className="form-error" role="alert">{error}</small>}
  </label>;
}
