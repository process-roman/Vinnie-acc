// Deep-link quick add (blueprint 2.5): vinnie://add?amount=12.50&merchant=Starbucks&category=coffee
// Bad or missing parameters are dropped, never fatal.

import { activeCategories } from './categories';
import { parseDecimalToMinor } from './money';

export type QuickAdd = {
  amountMinor?: number;
  merchant?: string;
  category?: string;
};

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const MAX_MERCHANT = 60;

export function parseQuickAdd(params: Params): QuickAdd {
  const out: QuickAdd = {};
  const amount = first(params.amount);
  if (amount) {
    const minor = parseDecimalToMinor(amount);
    if (minor !== null) out.amountMinor = minor;
  }
  const merchant = first(params.merchant)
    ?.replace(/[\u0000-\u001f]/g, '')
    .trim();
  if (merchant) out.merchant = merchant.slice(0, MAX_MERCHANT);
  const category = first(params.category)?.trim().toLowerCase();
  if (category) {
    const match = activeCategories().find(
      (c) => c.id === category || c.label.toLowerCase() === category,
    );
    if (match) out.category = match.id;
  }
  return out;
}
