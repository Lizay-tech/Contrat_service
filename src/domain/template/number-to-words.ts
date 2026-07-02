/**
 * Conversion d'un entier positif en toutes lettres (francais standard).
 * Couvre 0 a 999 999 999 999 (jusqu'aux milliards), suffisant pour des montants.
 */
const UNITS = [
  'zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt',
];

function belowHundred(n: number): string {
  if (n < 20) return UNITS[n] as string;
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  // Cas 70-79 et 90-99: base 60/80 + reste 10-19.
  if (ten === 7 || ten === 9) {
    const base = TENS[ten] as string;
    const rest = belowHundred(10 + unit);
    return unit === 1 && ten === 7 ? `${base} et onze` : `${base}-${rest}`;
  }
  let word = TENS[ten] as string;
  if (unit === 0) {
    // "quatre-vingts" prend un s s'il n'est pas suivi d'un nombre.
    return ten === 8 ? `${word}s` : word;
  }
  if (unit === 1 && ten !== 8) return `${word} et un`;
  return `${word}-${UNITS[unit]}`;
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const prefix = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
  if (rest === 0) return hundreds > 1 ? `${prefix}s` : prefix;
  return `${prefix} ${belowHundred(rest)}`;
}

function chunkToWords(n: number, singular: string, plural: string): string {
  if (n === 0) return '';
  if (n === 1) return singular; // "mille" (pas "un mille")
  return `${belowThousand(n)} ${plural}`;
}

export function numberToFrenchWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts = [
    billions > 0 ? `${belowThousand(billions)} ${billions > 1 ? 'milliards' : 'milliard'}` : '',
    millions > 0 ? `${belowThousand(millions)} ${millions > 1 ? 'millions' : 'million'}` : '',
    chunkToWords(thousands, 'mille', 'mille'),
    rest > 0 ? belowThousand(rest) : '',
  ].filter(Boolean);

  return parts.join(' ').trim();
}

const CURRENCY_WORDS: Record<string, string> = {
  HTG: 'gourdes',
  USD: 'dollars americains',
  CAD: 'dollars canadiens',
  EUR: 'euros',
};

/** Montant en lettres avec devise (ex. "vingt-cinq mille gourdes"). */
export function amountInWords(amount: number, currency: string): string {
  const words = numberToFrenchWords(amount);
  const unit = CURRENCY_WORDS[currency.toUpperCase()] ?? currency;
  return `${words} ${unit}`;
}
