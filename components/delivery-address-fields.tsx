"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Check, MapPin, Search } from "lucide-react";
import { deliveryAreaCity, deliveryAreas } from "@/lib/delivery-areas";
import { cepDigits, emptyDeliveryAddress, formatCep, lookupCep, type DeliveryAddress } from "@/lib/delivery-address";

export type AddressLookupState = "idle" | "loading" | "blocked";

export default function DeliveryAddressFields({ value, onChange, onLookupState }: {
  value: DeliveryAddress;
  onChange: Dispatch<SetStateAction<DeliveryAddress>>;
  onLookupState: Dispatch<SetStateAction<AddressLookupState>>;
}) {
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "blocked">("idle");

  useEffect(() => {
    if (cepDigits(value.cep).length !== 8) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setFeedback("Buscando endereço…");
      onLookupState("loading");
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const found = await lookupCep(value.cep, controller.signal);
        if (!active) return;
        const outside = found.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() !== deliveryAreaCity(found.neighborhood).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || found.state !== "PB" || (Boolean(found.postalNeighborhood) && !found.neighborhood);
        onChange(current => ({ ...current, street: found.street, neighborhood: found.neighborhood, city: found.city, state: found.state }));
        onLookupState(outside ? "blocked" : "idle");
        setStatus(outside ? "blocked" : "success");
        setFeedback(outside
          ? `Este CEP fica em ${found.postalNeighborhood ? `${found.postalNeighborhood}, ` : ""}${found.city} - ${found.state}, fora da nossa área de entrega. Confira o CEP ou escolha retirada.`
          : "Endereço encontrado. Confira os dados e informe o número e o complemento, se houver.");
      } catch (error) {
        if (!active) return;
        onLookupState("idle");
        setStatus("error");
        setFeedback(error instanceof Error && error.name !== "AbortError" ? error.message : "A consulta demorou mais que o esperado. Preencha o endereço manualmente.");
      } finally { window.clearTimeout(timeout); }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [value.cep, onChange, onLookupState]);

  function changeCep(text: string) {
    const cep = formatCep(text);
    if (cep === value.cep) return;
    onChange({ ...emptyDeliveryAddress, cep });
    onLookupState(cepDigits(cep).length === 8 ? "loading" : "idle");
    setStatus("idle");
    setFeedback("");
  }

  function manual() {
    onChange(current => { const neighborhood = status === "blocked" ? "" : current.neighborhood; return { ...current, cep: "", city: deliveryAreaCity(neighborhood), state: "PB", neighborhood }; });
    onLookupState("idle");
    setStatus("idle");
    setFeedback("Preencha seu endereço e selecione um dos bairros atendidos.");
  }

  const update = (field: keyof DeliveryAddress, text: string) => onChange(current => ({ ...current, [field]: text }));
  const blocked = status === "blocked";
  const loading = status === "loading";

  return <fieldset className="checkout-address">
    <legend><MapPin size={19} aria-hidden="true" /> Endereço de entrega</legend>
    <p className="checkout-address-intro">Digite seu CEP para preencher o endereço. Entregamos nos bairros indicados de João Pessoa e em Intermares (Cabedelo) - PB.</p>
    <div className="checkout-cep-row">
      <label htmlFor="delivery-cep">CEP<input id="delivery-cep" name="postal-code" value={value.cep} onChange={event => changeCep(event.target.value)} autoComplete="postal-code" inputMode="numeric" placeholder="00000-000" maxLength={9} pattern="[0-9]{5}-?[0-9]{3}" aria-describedby="delivery-cep-feedback" aria-invalid={status === "error" || blocked} /></label>
      <button className="checkout-address-manual" type="button" onClick={manual}>{value.cep ? "Preencher sem CEP" : "Não sei meu CEP"}</button>
    </div>
    <p id="delivery-cep-feedback" className={`checkout-cep-feedback is-${status}`} role="status" aria-live="polite">{status === "success" ? <Check size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}<span>{feedback || "Ao informar os 8 dígitos, buscamos a rua e o bairro para você."}</span></p>
    <div className="fields checkout-address-grid" aria-busy={loading}>
      <label className="address-street" htmlFor="delivery-street">Rua ou avenida<input id="delivery-street" value={value.street} onChange={event => update("street", event.target.value)} autoComplete="address-line1" placeholder="Nome da rua ou avenida" required minLength={3} maxLength={90} disabled={loading || blocked} /></label>
      <label htmlFor="delivery-number">Número<input id="delivery-number" value={value.number} onChange={event => update("number", event.target.value)} placeholder="Ex.: 159 ou S/N" required maxLength={12} disabled={loading || blocked} /></label>
      <label htmlFor="delivery-complement">Complemento <span className="address-optional">opcional</span><input id="delivery-complement" value={value.complement} onChange={event => update("complement", event.target.value)} autoComplete="address-line2" placeholder="Apto., bloco ou casa" maxLength={40} disabled={loading || blocked} /></label>
      <label className="address-neighborhood" htmlFor="delivery-neighborhood">Bairro<select id="delivery-neighborhood" value={value.neighborhood} onChange={event => { const neighborhood = event.target.value; onChange(current => ({ ...current, neighborhood, city: current.cep ? current.city : deliveryAreaCity(neighborhood) })); }} autoComplete="address-level3" required disabled={loading || blocked}><option value="" disabled>Selecione seu bairro</option>{deliveryAreas.map(area => <option key={area.name} value={area.name}>{area.name}{area.city ? ` (${area.city})` : ""} · {area.fee === 0 ? "Frete grátis" : area.fee === "combinar" ? "Taxa a combinar no WhatsApp (grátis acima de R$ 60)" : "R$ 5,00 (grátis acima de R$ 60)"}</option>)}</select></label>
      <label className="address-city" htmlFor="delivery-city">Cidade / UF<input id="delivery-city" value={`${value.city} - ${value.state}`} readOnly autoComplete="off" /></label>
      <label className="address-reference" htmlFor="delivery-reference">Ponto de referência <span className="address-optional">opcional</span><input id="delivery-reference" value={value.reference} onChange={event => update("reference", event.target.value)} placeholder="Ex.: em frente à praça" maxLength={50} disabled={loading || blocked} /></label>
    </div>
  </fieldset>;
}
