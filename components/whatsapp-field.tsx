"use client";

import { useState } from "react";
import { normalizeBrazilianMobile, phoneValidationMessage } from "@/lib/phone";

export default function WhatsAppField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !normalizeBrazilianMobile(value);

  function validate(input: HTMLInputElement) {
    input.setCustomValidity(normalizeBrazilianMobile(input.value) ? "" : phoneValidationMessage);
  }

  return <label htmlFor="checkout-phone">WhatsApp
    <input id="checkout-phone" name="phone" type="tel" value={value} autoComplete="tel" inputMode="tel"
      placeholder="(83) 99912-3456" required maxLength={32}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? "checkout-phone-error" : "checkout-phone-help"}
      onChange={event => { onChange(event.target.value); validate(event.currentTarget); }}
      onBlur={event => { setTouched(true); validate(event.currentTarget); }}
      onInvalid={event => { setTouched(true); validate(event.currentTarget); }} />
    {invalid ? <small id="checkout-phone-error" className="form-error" role="alert">{phoneValidationMessage}</small>
      : <small id="checkout-phone-help">Inclua o DDD e os 9 dígitos do celular. Pode usar +55.</small>}
  </label>;
}
