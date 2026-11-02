// Quick chips (blueprint 2.4): the user's most frequent recent purchases as
// one-tap entries, at the price they usually pay.

import { Entry } from './entries';

export type QuickChip = {
  key: string;
  description: string;
  category: string;
  amountMinor: number;
};

export const CHIP_WINDOW_DAYS = 30;
export const MAX_CHIPS = 6;

const DAY = 24 * 3600 * 1000;

/** The most common amount; ties go to the most recent. */
function usualAmount(entries: readonly Entry[]): number {
  const counts = new Map<number, { n: number; last: number }>();
  for (const e of entries) {
    const c = counts.get(e.amountMinor) ?? { n: 0, last: 0 };
    counts.set(e.amountMinor, { n: c.n + 1, last: Math.max(c.last, e.createdAt) });
  }
  return [...counts].sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)[0][0];
}

export function quickChips(entries: readonly Entry[], now: Date, max = MAX_CHIPS): QuickChip[] {
  const since = now.getTime() - CHIP_WINDOW_DAYS * DAY;
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.type !== 'expense' || e.createdAt < since) continue;
    const label = e.description.trim().toLowerCase();
    const key = `${e.category}:${label}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    [...groups]
      .map(([key, group]) => {
        const last = Math.max(...group.map((e) => e.createdAt));
        // Frequency matters most; recency (0..1 over the window) breaks ties.
        const score = group.length + (last - since) / (CHIP_WINDOW_DAYS * DAY);
        const latest = group.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
        return {
          chip: {
            key,
            description: latest.description.trim(),
            category: latest.category,
            amountMinor: usualAmount(group),
          },
          score,
          count: group.length,
        };
      })
      // A one-off isn't a habit; only repeat purchases become chips.
      .filter((g) => g.count >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((g) => g.chip)
  );
}
