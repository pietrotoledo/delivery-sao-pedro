import { deliveryAreaCity, deliveryAreas } from "./delivery-areas";

export type DeliveryAddress = {
  cep: string; street: string; number: string; complement: string; reference: string;
  neighborhood: string; city: string; state: string;
};

export const emptyDeliveryAddress: DeliveryAddress = {
  cep: "", street: "", number: "", complement: "", reference: "",
  neighborhood: "", city: "João Pessoa", state: "PB",
};

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
export const cepDigits = (value: string) => value.replace(/\D/g, "").slice(0, 8);
export function formatCep(value: string) {
  const digits = cepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function servedNeighborhood(value: string): string {
  const aliases: Record<string, string> = { estados: "Bairro dos Estados", "altiplano cabo branco": "Altiplano", "jardim intermares": "Intermares" };
  const name = aliases[normalize(value)] ?? value;
  return deliveryAreas.find(area => normalize(area.name) === normalize(name))?.name ?? "";
}

export function formatDeliveryAddress(value: DeliveryAddress) {
  return [
    `${value.street.trim()}, ${value.number.trim()}`,
    value.complement.trim(), value.neighborhood,
    `${value.city} - ${value.state}`,
    value.cep ? `CEP ${formatCep(value.cep)}` : "",
    value.reference.trim() ? `Referência: ${value.reference.trim()}` : "",
  ].filter(Boolean).join(" · ");
}

export function deliveryAddressError(value: DeliveryAddress): string | null {
  if (value.cep && !/^\d{5}-?\d{3}$/.test(value.cep)) return "Informe um CEP com 8 dígitos ou escolha preencher sem CEP.";
  if (!deliveryAreas.some(area => area.name === value.neighborhood)) return "Selecione um dos bairros atendidos para continuar.";
  if (normalize(value.city) !== normalize(deliveryAreaCity(value.neighborhood)) || value.state.toUpperCase() !== "PB") return "Fazemos entregas apenas nos bairros atendidos de João Pessoa e em Intermares (Cabedelo) - PB.";
  if (value.street.trim().length < 3 || !value.number.trim()) return "Informe a rua e o número. Se não houver número, escreva S/N.";
  if (value.street.length > 90 || value.number.length > 12 || value.complement.length > 40 || value.reference.length > 50 || formatDeliveryAddress(value).length > 220) return "Resuma o endereço, o complemento e a referência para até 220 caracteres no total.";
  return null;
}

export function parseDeliveryAddress(value: unknown): DeliveryAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const fields = Object.keys(emptyDeliveryAddress) as (keyof DeliveryAddress)[];
  if (fields.some(field => typeof record[field] !== "string")) return null;
  return Object.fromEntries(fields.map(field => [field, (record[field] as string).trim()])) as DeliveryAddress;
}

export async function lookupCep(cep: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const digits = cepDigits(cep);
  if (digits.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
  const response = await request(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) throw new Error("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new Error("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
  const data = result as Record<string, unknown>;
  if (data.erro) throw new Error("CEP não encontrado. Confira os números ou preencha o endereço manualmente.");
  if (typeof data.localidade !== "string" || typeof data.uf !== "string" || typeof data.bairro !== "string" || typeof data.logradouro !== "string") throw new Error("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
  return { street: data.logradouro, neighborhood: servedNeighborhood(data.bairro), city: data.localidade, state: data.uf, postalNeighborhood: data.bairro };
}
