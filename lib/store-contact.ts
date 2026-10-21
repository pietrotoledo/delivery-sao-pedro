// WhatsApp da loja exibido ao cliente; pode ser importado no navegador.
export const defaultStoreWhatsapp = "5561996479192";

export function phoneLabel(number: string) {
  const digits = number.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return number;
}
