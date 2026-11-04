// Where the money went, as slices of a pie: for one month or for all time.

import { getCategory } from './categories';
import { Entry, toMonthKey } from './entries';

/** More slices than this can't be read, so the smallest fold into one. */
export const MAX_SLICES = 6;
export const REST_SLICE_ID = 'rest';
const REST_COLOR = '#B9AE98';

export type Slice = {
  id: string;
  label: string;
  color: string;
  totalMinor: number;
  /** Whole percents; across all the slices they always add up to 100. */
  percent: number;
};

export type SpendingBreakdown = { totalMinor: number; slices: Slice[] };

/** Months with any spending in them, newest first. */
export function spendingMonths(entries: readonly Entry[]): string[] {
  const months = new Set(
    entries.filter((e) => e.type === 'expense').map((e) => toMonthKey(e.date)),
  );
  return [...months].sort().reverse();
}

/** Rounds shares to whole percents that add up to 100, giving spares to the largest remainders. */
function wholePercents(totals: readonly number[], sum: number): number[] {
  const exact = totals.map((t) => (t / sum) * 100);
  const out = exact.map(Math.floor);
  const spare = 100 - out.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, left: v - Math.floor(v) }))
    .sort((a, b) => b.left - a.left || a.i - b.i);
  for (let k = 0; k < spare; k++) out[byRemainder[k].i] += 1;
  return out;
}

/** Biggest first. `month` is a month key, or null for all time. */
export function spendingBreakdown(
  entries: readonly Entry[],
  month: string | null,
): SpendingBreakdown {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense' || (month && toMonthKey(e.date) !== month)) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountMinor);
  }
  const sorted = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const totalMinor = sorted.reduce((sum, [, t]) => sum + t, 0);
  if (!totalMinor) return { totalMinor: 0, slices: [] };

  const parts = sorted.map(([id, t]) => {
    const c = getCategory(id);
    return { id, label: c.label, color: c.color, totalMinor: t };
  });
  if (parts.length > MAX_SLICES) {
    const rest = parts.splice(MAX_SLICES - 1);
    parts.push({
      id: REST_SLICE_ID,
      label: `${rest.length} smaller ones`,
      color: REST_COLOR,
      totalMinor: rest.reduce((sum, p) => sum + p.totalMinor, 0),
    });
  }
  const percents = wholePercents(
    parts.map((p) => p.totalMinor),
    totalMinor,
  );
  return { totalMinor, slices: parts.map((p, i) => ({ ...p, percent: percents[i] })) };
}

/**
 * Which slice a point falls in. x and y are relative to the pie's centre, angles run
 * clockwise from 12 o'clock, and `inner` and `outer` are the ring's radii.
 */
export function sliceAt(
  slices: readonly Slice[],
  x: number,
  y: number,
  inner: number,
  outer: number,
): Slice | null {
  const r = Math.hypot(x, y);
  if (r < inner || r > outer || !slices.length) return null;
  const turn = (Math.atan2(x, -y) / (Math.PI * 2) + 1) % 1;
  const total = slices.reduce((sum, s) => sum + s.totalMinor, 0);
  let reached = 0;
  for (const s of slices) {
    reached += s.totalMinor / total;
    if (turn < reached) return s;
  }
  return slices[slices.length - 1];
}
