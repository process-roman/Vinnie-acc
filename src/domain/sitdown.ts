// The weekly sit-down (blueprint §9, 7.2): Vinnie goes through your week.
// Weeks run Monday to Sunday.

import { getCategory } from './categories';
import { Entry, toDateKey } from './entries';
import type { LedgerEntry } from './reaction/ledger';
import type { Tier } from './reaction/tier';

export type ReviewEntry = Entry & { tier?: Tier | null };

export type WeeklyReview = {
  weekKey: string;
  from: string;
  to: string;
  spentMinor: number;
  count: number;
  topCategory: { category: string; totalMinor: number } | null;
  best: ReviewEntry | null;
  worst: ReviewEntry | null;
  savedMinor: number;
  promisesKept: number;
  promisesBroken: number;
};

export const SITDOWN_COINS = 20;
export const SITDOWN_MOOD = 6;

/** Monday of the week containing `d`, as YYYY-MM-DD. Also the week's key. */
export function weekStart(d: Date): string {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (day.getDay() + 6) % 7; // Monday = 0
  day.setDate(day.getDate() - offset);
  return toDateKey(day);
}

export function weekEnd(d: Date): string {
  const start = new Date(`${weekStart(d)}T12:00:00`);
  start.setDate(start.getDate() + 6);
  return toDateKey(start);
}

const BAD: readonly (Tier | null | undefined)[] = ['meltdown', 'angry', 'judge'];

export function weeklyReview(
  entries: readonly ReviewEntry[],
  ledger: readonly LedgerEntry[],
  now: Date,
): WeeklyReview {
  const from = weekStart(now);
  const to = weekEnd(now);
  const week = entries.filter((e) => e.date >= from && e.date <= to);
  const expenses = week.filter((e) => e.type === 'expense');

  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountMinor);
  const top = [...totals].sort((a, b) => b[1] - a[1])[0];

  const biggest = (list: ReviewEntry[]) =>
    list.reduce<ReviewEntry | null>((m, e) => (!m || e.amountMinor > m.amountMinor ? e : m), null);
  // Best: the biggest save or skip; failing that, the biggest essential.
  const best =
    biggest(week.filter((e) => e.type !== 'expense')) ??
    biggest(expenses.filter((e) => getCategory(e.category).kind === 'essential'));
  // Worst: the biggest one he got upset about; failing that, the biggest treat.
  const worst =
    biggest(expenses.filter((e) => BAD.includes(e.tier))) ??
    biggest(expenses.filter((e) => getCategory(e.category).kind === 'discretionary'));

  const fromMs = new Date(`${from}T00:00:00`).getTime();
  const toMs = new Date(`${to}T23:59:59`).getTime();
  const resolvedInWeek = (r: 'kept' | 'broken') =>
    ledger.filter(
      (l) =>
        l.resolved === r && l.resolvedAt !== null && l.resolvedAt >= fromMs && l.resolvedAt <= toMs,
    ).length;

  return {
    weekKey: from,
    from,
    to,
    spentMinor: expenses.reduce((s, e) => s + e.amountMinor, 0),
    count: week.length,
    topCategory: top ? { category: top[0], totalMinor: top[1] } : null,
    best,
    worst,
    savedMinor: week.filter((e) => e.type === 'saved').reduce((s, e) => s + e.amountMinor, 0),
    promisesKept: resolvedInWeek('kept'),
    promisesBroken: resolvedInWeek('broken'),
  };
}

/** The sit-down opens from Friday through Sunday, once a week. */
export function sitdownAvailable(now: Date, doneWeeks: ReadonlySet<string>): boolean {
  const day = now.getDay();
  return (day === 5 || day === 6 || day === 0) && !doneWeeks.has(weekStart(now));
}
