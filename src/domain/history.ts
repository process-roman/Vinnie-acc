// History list (blueprint 2.2): search, filter and group by month.

import { getCategory } from './categories';
import { Entry, toMonthKey } from './entries';

export type HistoryFilter = {
  query?: string;
  category?: string | null;
};

export function filterEntries<T extends Entry>(entries: readonly T[], f: HistoryFilter): T[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  return entries.filter((e) => {
    if (f.category && e.category !== f.category) return false;
    if (!q) return true;
    return (
      e.description.toLowerCase().includes(q) ||
      getCategory(e.category).label.toLowerCase().includes(q)
    );
  });
}

export type MonthGroup<T> = {
  month: string;
  label: string;
  /** Expenses only. */
  spentMinor: number;
  /** Newest first. */
  entries: T[];
};

export function groupByMonth<T extends Entry>(entries: readonly T[]): MonthGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const e of entries) {
    const m = toMonthKey(e.date);
    groups.set(m, [...(groups.get(m) ?? []), e]);
  }
  return [...groups]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, list]) => ({
      month,
      label: monthLabel(month),
      spentMinor: list.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amountMinor, 0),
      entries: [...list].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      ),
    }));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Today", "Yesterday", or "Mon, Nov 2". */
export function dayLabel(date: string, now: Date): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / (24 * 3600 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
