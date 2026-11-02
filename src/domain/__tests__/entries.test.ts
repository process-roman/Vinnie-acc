import { describe, expect, it } from '@jest/globals';

import { categoryStats, daysLeft, Entry, monthSpentMinor, toDateKey } from '../entries';

const now = new Date(2026, 10, 20, 12); // Nov 20, 2026
const hour = 3600 * 1000;

const entry = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36),
  type: 'expense',
  amountMinor: 1000,
  category: 'coffee',
  description: '',
  date: toDateKey(now),
  createdAt: now.getTime(),
  ...over,
});

describe('entries', () => {
  it('counts days left including today', () => {
    expect(daysLeft(now)).toBe(11);
    expect(daysLeft(new Date(2026, 1, 28))).toBe(1);
  });

  it('sums only this month’s expenses', () => {
    const entries = [
      entry({ amountMinor: 500 }),
      entry({ amountMinor: 700, date: '2026-10-31' }),
      entry({ amountMinor: 900, type: 'saved' }),
    ];
    expect(monthSpentMinor(entries, now)).toBe(500);
  });

  it('computes category stats', () => {
    const entries = [
      entry({ amountMinor: 600, createdAt: now.getTime() - 2 * hour }),
      entry({ amountMinor: 400, createdAt: now.getTime() - 50 * hour, date: '2026-11-18' }),
      entry({ amountMinor: 2000, category: 'groceries' }),
    ];
    expect(categoryStats(entries, 'coffee', now)).toEqual({
      countLast48h: 1,
      countThisMonth: 2,
      monthTotalMinor: 1000,
      avgMinor: 500,
    });
    expect(categoryStats([], 'coffee', now).avgMinor).toBeNull();
  });
});
