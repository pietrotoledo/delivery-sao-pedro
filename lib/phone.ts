// DDDs brasileiros e formato móvel definidos pelo plano de numeração da Anatel.
const areaCodes = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));

export const phoneValidationMessage = 'Informe um celular válido com DDD e 9 dígitos. Ex.: (83) 99912-3456.';

/** Returns country code + DDD + mobile number, or null. Does not verify ownership. */
export function normalizeBrazilianMobile(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (input.startsWith('+') && (digits.length !== 13 || !digits.startsWith('55'))) return null;
  if (national.length !== 11 || !areaCodes.has(national.slice(0, 2))) return null;
  const subscriber = national.slice(2);
  if (!/^9\d{8}$/.test(subscriber) || /^(\d)\1{8}$/.test(subscriber)) return null;
  return `55${national}`;
}
