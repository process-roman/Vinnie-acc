import { describe, expect, it } from '@jest/globals';

import { Entry } from '../entries';
import { MAX_SLICES, REST_SLICE_ID, sliceAt, spendingBreakdown, spendingMonths } from '../spending';

let n = 0;
const e = (
  category: string,
  amountMinor: number,
  date = '2026-11-05',
  over: Partial<Entry> = {},
): Entry => ({
  id: String(n++),
  type: 'expense',
  amountMinor,
  category,
  description: '',
  date,
  createdAt: 0,
  ...over,
});

describe('spendingBreakdown', () => {
  it('shows nothing when nothing was spent', () => {
    expect(spendingBreakdown([], null)).toEqual({ totalMinor: 0, slices: [] });
  });

  it('adds up categories, biggest first', () => {
    const { totalMinor, slices } = spendingBreakdown(
      [e('coffee', 1000), e('groceries', 6000), e('coffee', 3000)],
      '2026-11',
    );
    expect(totalMinor).toBe(10000);
    expect(slices.map((s) => [s.id, s.totalMinor, s.percent])).toEqual([
      ['groceries', 6000, 60],
      ['coffee', 4000, 40],
    ]);
  });

  it('keeps to the month, or takes all of time', () => {
    const entries = [e('coffee', 1000, '2026-10-30'), e('fun', 3000, '2026-11-01')];
    expect(spendingBreakdown(entries, '2026-10').totalMinor).toBe(1000);
    expect(spendingBreakdown(entries, null).totalMinor).toBe(4000);
  });

  it('only counts money spent', () => {
    const entries = [
      e('coffee', 1000),
      e('coffee', 500, '2026-11-05', { type: 'skipped' }),
      e('other', 900, '2026-11-05', { type: 'saved' }),
    ];
    expect(spendingBreakdown(entries, null).totalMinor).toBe(1000);
  });

  it('has percents that always add up to 100', () => {
    const { slices } = spendingBreakdown([e('coffee', 1), e('fun', 1), e('games', 1)], null);
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    expect(slices.map((s) => s.percent).sort()).toEqual([33, 33, 34]);
  });

  it('folds the smallest into one slice when there are too many', () => {
    const ids = [
      'groceries',
      'bills',
      'transport',
      'health',
      'coffee',
      'dining',
      'delivery',
      'fun',
    ];
    const { totalMinor, slices } = spendingBreakdown(
      ids.map((id, i) => e(id, 1000 - i * 10)),
      null,
    );
    expect(slices).toHaveLength(MAX_SLICES);
    const rest = slices[slices.length - 1];
    expect(rest.id).toBe(REST_SLICE_ID);
    expect(rest.label).toBe('3 smaller ones');
    expect(slices.reduce((sum, s) => sum + s.totalMinor, 0)).toBe(totalMinor);
  });
});

describe('spendingMonths', () => {
  it('lists months with spending, newest first', () => {
    const entries = [
      e('coffee', 1, '2026-09-01'),
      e('coffee', 1, '2026-11-01'),
      e('coffee', 1, '2026-10-01', { type: 'saved' }),
      e('coffee', 1, '2026-09-20'),
    ];
    expect(spendingMonths(entries)).toEqual(['2026-11', '2026-09']);
  });
});

describe('sliceAt', () => {
  const { slices } = spendingBreakdown([e('groceries', 7500), e('coffee', 2500)], null);

  it("goes clockwise from 12 o'clock", () => {
    expect(sliceAt(slices, 10, -20, 10, 50)?.id).toBe('groceries');
    expect(sliceAt(slices, 30, 0.1, 10, 50)?.id).toBe('groceries');
    expect(sliceAt(slices, -30, -1, 10, 50)?.id).toBe('coffee');
  });

  it('ignores the hole and outside the ring', () => {
    expect(sliceAt(slices, 2, 2, 10, 50)).toBeNull();
    expect(sliceAt(slices, 60, 60, 10, 50)).toBeNull();
    expect(sliceAt([], 20, 20, 10, 50)).toBeNull();
  });
});
