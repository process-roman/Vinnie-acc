import { describe, expect, it } from '@jest/globals';

import { summarizeMonth } from '../budget';
import { Entry } from '../entries';

const now = new Date(2026, 10, 21, 12); // Nov 21: 10 days left
const e = (amountMinor: number, category: string, over: Partial<Entry> = {}): Entry => ({
  id: Math.random().toString(36),
  type: 'expense',
  amountMinor,
  category,
  description: '',
  date: '2026-11-05',
  createdAt: 0,
  ...over,
});

describe('summarizeMonth', () => {
  const entries = [
    e(50000, 'bills'),
    e(3000, 'coffee'),
    e(7000, 'coffee'),
    e(4000, 'dining', { date: '2026-10-30' }),
    e(2500, 'other', { type: 'saved' }),
    e(9000, 'shopping', { type: 'skipped' }),
  ];

  it('totals the month and splits by category', () => {
    const s = summarizeMonth(entries, 100000, now);
    expect(s.spentMinor).toBe(60000);
    expect(s.remainingMinor).toBe(40000);
    expect(s.share).toBeCloseTo(0.6);
    expect(s.daysLeft).toBe(10);
    expect(s.dailyAllowanceMinor).toBe(4000);
    expect(s.savedMinor).toBe(2500);
    expect(s.skippedMinor).toBe(9000);
    expect(s.byCategory.map((c) => [c.category, c.totalMinor])).toEqual([
      ['bills', 50000],
      ['coffee', 10000],
    ]);
  });

  it('never shows negative remaining when over budget', () => {
    const s = summarizeMonth(entries, 50000, now);
    expect(s.remainingMinor).toBe(0);
    expect(s.dailyAllowanceMinor).toBe(0);
    expect(s.share).toBeCloseTo(1.2);
  });

  it('works with no budget', () => {
    const s = summarizeMonth(entries, null, now);
    expect(s.share).toBeNull();
    expect(s.remainingMinor).toBeNull();
    expect(s.dailyAllowanceMinor).toBeNull();
  });

  it('handles an empty month', () => {
    const s = summarizeMonth([], 100000, now);
    expect(s.spentMinor).toBe(0);
    expect(s.byCategory).toEqual([]);
  });
});
