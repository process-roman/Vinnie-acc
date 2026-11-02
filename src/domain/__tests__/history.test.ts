import { describe, expect, it } from '@jest/globals';

import { Entry } from '../entries';
import { dayLabel, filterEntries, groupByMonth } from '../history';

const e = (id: string, date: string, over: Partial<Entry> = {}): Entry => ({
  id,
  type: 'expense',
  amountMinor: 1000,
  category: 'coffee',
  description: '',
  date,
  createdAt: Number(id),
  ...over,
});

describe('history', () => {
  const entries = [
    e('1', '2026-10-30', { description: 'Pizza night', category: 'delivery' }),
    e('2', '2026-11-01', { description: 'Latte' }),
    e('3', '2026-11-01', { description: 'Rent', category: 'bills', amountMinor: 120000 }),
    e('4', '2026-11-02', { type: 'saved', category: 'other', amountMinor: 5000 }),
  ];

  it('searches description and category name', () => {
    expect(filterEntries(entries, { query: 'pizza' }).map((x) => x.id)).toEqual(['1']);
    expect(filterEntries(entries, { query: 'BILLS' }).map((x) => x.id)).toEqual(['3']);
    expect(filterEntries(entries, { query: '  ' })).toHaveLength(4);
  });

  it('filters by category', () => {
    expect(filterEntries(entries, { category: 'coffee' }).map((x) => x.id)).toEqual(['2']);
  });

  it('groups by month, newest first, with expense totals', () => {
    const groups = groupByMonth(entries);
    expect(groups.map((g) => g.label)).toEqual(['November 2026', 'October 2026']);
    expect(groups[0].entries.map((x) => x.id)).toEqual(['4', '3', '2']);
    expect(groups[0].spentMinor).toBe(121000);
  });

  it('labels days', () => {
    const now = new Date(2026, 10, 2, 9);
    expect(dayLabel('2026-11-02', now)).toBe('Today');
    expect(dayLabel('2026-11-01', now)).toBe('Yesterday');
    expect(dayLabel('2026-10-28', now)).toMatch(/Oct 28/);
  });
});
