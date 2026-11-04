// How much is too much for one purchase in a category: Vinnie's line. It has to make sense
// for any income and any category, including ones the user makes up, so it comes from:
//   1. the user's own number, if they set one;
//   2. otherwise a share of their monthly budget, set per category;
//   3. raised by what they really spend there, once he's seen enough receipts, so a normal
//      weekly shop doesn't set him off. It can't drift up forever: that's what he's for.

import { Category, CategoryKind } from './categories';

/** Used when no budget is set. */
const FALLBACK_BUDGET = 200000;
/** Receipts he needs to see before he trusts the user's habits. */
const LEARN_AFTER = 4;
/** A normal purchase is fine; this much over the usual is where he starts asking questions. */
const LEARN_MARGIN = 1.5;
/** Habits can raise the line this far above the starting point, and no further. */
const LEARN_CAP = 3;

const KIND_SHARE: Record<CategoryKind, number> = {
  essential: 0.15,
  discretionary: 0.05,
  mixed: 0.08,
};

/** Rounded to a number a person would say out loud. */
function roundLimit(minor: number): number {
  const step = minor < 2000 ? 100 : minor < 10000 ? 500 : minor < 100000 ? 1000 : 5000;
  return Math.max(step, Math.round(minor / step) * step);
}

/** His starting line for a category kind, for suggesting one when a category is created. */
export function suggestedLimit(kind: CategoryKind, monthlyLimitMinor: number | null): number {
  return roundLimit(KIND_SHARE[kind] * (monthlyLimitMinor ?? FALLBACK_BUDGET));
}

export type CategoryLimit = {
  limitMinor: number;
  /** Where the number came from, to tell the user. */
  source: 'yours' | 'learned' | 'vinnie';
};

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function categoryLimit(
  category: Category,
  opts: {
    userLimitMinor?: number;
    monthlyLimitMinor: number | null;
    /** What's been spent in this category before, one amount per receipt. */
    history: readonly number[];
  },
): CategoryLimit {
  if (opts.userLimitMinor) return { limitMinor: opts.userLimitMinor, source: 'yours' };
  const share = category.share ?? KIND_SHARE[category.kind];
  const start = roundLimit(share * (opts.monthlyLimitMinor ?? FALLBACK_BUDGET));
  if (opts.history.length < LEARN_AFTER) return { limitMinor: start, source: 'vinnie' };
  // The median, so one mad purchase doesn't teach him that's normal.
  const usual = roundLimit(median(opts.history) * LEARN_MARGIN);
  const learned = Math.min(usual, start * LEARN_CAP);
  return learned > start
    ? { limitMinor: learned, source: 'learned' }
    : { limitMinor: start, source: 'vinnie' };
}
