// Money is always an integer number of minor units (cents). Never floats.

export type Currency = 'USD' | 'CAD';

/** Keypad digits are entered cash-register style: "1250" means 12.50. */
export function keypadToMinor(digits: string): number {
  const clean = digits.replace(/\D/g, '').replace(/^0+/, '');
  return clean === '' ? 0 : parseInt(clean, 10);
}

export const MAX_KEYPAD_DIGITS = 8; // 999,999.99

/** Applies one keypad key to the digit string. */
export function pressKey(digits: string, key: string): string {
  if (key === 'back') return digits.slice(0, -1);
  const next = (digits + key).replace(/^0+/, '');
  return next.length > MAX_KEYPAD_DIGITS ? digits : next;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, cents: boolean): Intl.NumberFormat {
  const key = `${currency}:${cents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * "$12.50", or "$12" for whole amounts when `trimZeroCents` is set (how Vinnie says it).
 */
export function formatMoney(
  minor: number,
  currency: Currency = 'USD',
  { trimZeroCents = false }: { trimZeroCents?: boolean } = {},
): string {
  const cents = !(trimZeroCents && minor % 100 === 0);
  return formatter(currency, cents).format(minor / 100);
}
