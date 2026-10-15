const areaCodes = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export const phoneValidationMessage = 'Digite 11 números: 2 do DDD + 9 do celular. Ex.: (83) 99912-3456.';

export function brazilianMobileError(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return 'Informe seu celular com DDD.';
  const input = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(input)) return 'Use apenas números, com DDD. Você também pode colar com +55.';
  const digits = input.replace(/\D/g, '');
  if (input.startsWith('+') && !digits.startsWith('55')) return 'Use um celular do Brasil. O código do país é +55.';
  const national = digits.length >= 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 9) return 'Inclua os 2 números do DDD antes do celular. Ex.: (83) 99912-3456.';
  if (national.length < 11) return 'Número incompleto. Digite 2 números do DDD + 9 do celular, totalizando 11.';
  if (national.length > 11) return 'Há números a mais. Use 11 números com DDD, ou 13 incluindo o código 55.';
  if (input.startsWith('+') && digits.length !== 13) return 'Após +55, digite os 2 números do DDD e os 9 do celular.';
  if (!areaCodes.has(national.slice(0, 2))) return 'Confira o DDD informado. Exemplo de DDD válido: 83.';
  const subscriber = national.slice(2);
  if (!subscriber.startsWith('9')) return 'O número do celular deve começar com 9 após o DDD.';
  if (/^(\d)\1{8}$/.test(subscriber)) return 'Confira o celular: os 9 dígitos não podem ser todos iguais.';
  return null;
}

/** Keeps excess digits and invalid input visible for correction. */
export function formatBrazilianMobile(value: string): string {
  if (!value || !/^\+?[\d\s().-]+$/.test(value.trim())) return value;
  const digits = value.replace(/\D/g, '');
  const international = value.trim().startsWith('+55') || (digits.length === 13 && digits.startsWith('55'));
  if (value.trim().startsWith('+') && !international) return value;
  const national = international ? digits.slice(2) : digits;
  if (national.length > 11) return value;
  const prefix = international ? '+55 ' : '';
  if (national.length <= 2) return `${prefix}${national}`;
  const subscriber = national.slice(2);
  return `${prefix}(${national.slice(0, 2)}) ${subscriber.slice(0, 5)}${subscriber.length > 5 ? `-${subscriber.slice(5)}` : ''}`;
}

/** Returns country code + DDD + mobile number; does not verify ownership. */
export function normalizeBrazilianMobile(value: unknown): string | null {
  if (typeof value !== 'string' || brazilianMobileError(value)) return null;
  const digits = value.replace(/\D/g, '');
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  return `55${national}`;
}
