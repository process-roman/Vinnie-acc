import { getCategory } from './categories';

export type EntryType = 'expense' | 'saved' | 'skipped';

export type Entry = {
  id: string;
  type: EntryType;
  amountMinor: number;
  category: string;
  description: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Epoch ms when it was logged. */
  createdAt: number;
};

/** YYYY-MM-DD for a local date. */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** YYYY-MM for a local date or date key. */
export function toMonthKey(d: Date | string): string {
  return typeof d === 'string' ? d.slice(0, 7) : toDateKey(d).slice(0, 7);
}

export function daysInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/** Days left in the month, counting today. */
export function daysLeft(now: Date): number {
  return daysInMonth(now) - now.getDate() + 1;
}

/** Total spent (expenses only) in the month of `now`. */
export function monthSpentMinor(entries: readonly Entry[], now: Date): number {
  const month = toMonthKey(now);
  return entries
    .filter((e) => e.type === 'expense' && toMonthKey(e.date) === month)
    .reduce((sum, e) => sum + e.amountMinor, 0);
}

export type CategoryStats = {
  /** Expenses in this category logged in the last 48 hours. */
  countLast48h: number;
  /** Expenses in this category this month. */
  countThisMonth: number;
  monthTotalMinor: number;
  /** Average expense in this category over all history, or null if none. */
  avgMinor: number | null;
};

export function categoryStats(
  entries: readonly Entry[],
  category: string,
  now: Date,
): CategoryStats {
  const month = toMonthKey(now);
  const since48h = now.getTime() - 48 * 3600 * 1000;
  const inCat = entries.filter((e) => e.type === 'expense' && e.category === category);
  const thisMonth = inCat.filter((e) => toMonthKey(e.date) === month);
  return {
    countLast48h: inCat.filter((e) => e.createdAt >= since48h).length,
    countThisMonth: thisMonth.length,
    monthTotalMinor: thisMonth.reduce((s, e) => s + e.amountMinor, 0),
    avgMinor: inCat.length
      ? Math.round(inCat.reduce((s, e) => s + e.amountMinor, 0) / inCat.length)
      : null,
  };
}

export function isDiscretionary(category: string): boolean {
  return getCategory(category).kind === 'discretionary';
}
