// Month summary for the Budget sheet and header (blueprint 1.3, Screen 4).

import { activeCategories } from './categories';
import { daysLeft, Entry, toMonthKey } from './entries';

export type CategoryTotal = { category: string; totalMinor: number; share: number };

export type BudgetSummary = {
  limitMinor: number | null;
  spentMinor: number;
  /** Never negative. */
  remainingMinor: number | null;
  /** Spent / limit (can exceed 1), or null with no budget. */
  share: number | null;
  daysLeft: number;
  /** What's left per remaining day, rounded down to the cent. */
  dailyAllowanceMinor: number | null;
  savedMinor: number;
  skippedMinor: number;
  /** Expense totals by category, biggest first. */
  byCategory: CategoryTotal[];
};

export function summarizeMonth(
  entries: readonly Entry[],
  limitMinor: number | null,
  now: Date,
): BudgetSummary {
  const month = toMonthKey(now);
  const inMonth = entries.filter((e) => toMonthKey(e.date) === month);
  const sum = (type: Entry['type']) =>
    inMonth.filter((e) => e.type === type).reduce((s, e) => s + e.amountMinor, 0);
  const spent = sum('expense');

  const totals = new Map<string, number>();
  for (const e of inMonth) {
    if (e.type === 'expense') totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountMinor);
  }
  const order = new Map(activeCategories().map((c, i) => [c.id, i]));
  const byCategory = [...totals]
    .map(([category, totalMinor]) => ({
      category,
      totalMinor,
      share: spent ? totalMinor / spent : 0,
    }))
    .sort(
      (a, b) =>
        b.totalMinor - a.totalMinor ||
        (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99),
    );

  const left = daysLeft(now);
  const remaining = limitMinor === null ? null : Math.max(0, limitMinor - spent);
  return {
    limitMinor,
    spentMinor: spent,
    remainingMinor: remaining,
    share: limitMinor ? spent / limitMinor : limitMinor === 0 ? (spent > 0 ? Infinity : 0) : null,
    daysLeft: left,
    dailyAllowanceMinor: remaining === null ? null : Math.floor(remaining / left),
    savedMinor: sum('saved'),
    skippedMinor: sum('skipped'),
    byCategory,
  };
}
