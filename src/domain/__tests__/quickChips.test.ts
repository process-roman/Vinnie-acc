import { describe, expect, it } from '@jest/globals';

import { Entry } from '../entries';
import { quickChips } from '../quickChips';

const now = new Date(2026, 10, 21, 12);
const DAY = 24 * 3600 * 1000;
let n = 0;
const e = (
  description: string,
  amountMinor: number,
  daysAgo: number,
  over: Partial<Entry> = {},
): Entry => ({
  id: String(n++),
  type: 'expense',
  amountMinor,
  category: 'coffee',
  description,
  date: '2026-11-01',
  createdAt: now.getTime() - daysAgo * DAY,
  ...over,
});

describe('quickChips', () => {
  it('ranks by frequency, then recency', () => {
    const chips = quickChips(
      [
        e('Latte', 650, 1),
        e('Latte', 650, 3),
        e('Latte', 650, 5),
        e('Bagel', 400, 2, { category: 'dining' }),
        e('Bagel', 400, 4, { category: 'dining' }),
        e('Cold brew', 550, 20),
        e('Cold brew', 550, 25),
      ],
      now,
    );
    expect(chips.map((c) => c.description)).toEqual(['Latte', 'Bagel', 'Cold brew']);
  });

  it('uses the usual price', () => {
    const [chip] = quickChips([e('Latte', 650, 1), e('Latte', 700, 2), e('Latte', 650, 3)], now);
    expect(chip.amountMinor).toBe(650);
  });

  it('matches descriptions case-insensitively', () => {
    expect(quickChips([e('latte', 650, 1), e('Latte ', 650, 2)], now)).toHaveLength(1);
  });

  it('ignores one-offs, old entries, savings and skips', () => {
    const chips = quickChips(
      [
        e('Once', 100, 1),
        e('Old', 100, 40),
        e('Old', 100, 45),
        e('Vault', 100, 1, { type: 'saved' }),
        e('Vault', 100, 2, { type: 'saved' }),
      ],
      now,
    );
    expect(chips).toEqual([]);
  });

  it('caps the number of chips', () => {
    const many = Array.from({ length: 10 }, (_, i) => [
      e(`Item ${i}`, 100, 1),
      e(`Item ${i}`, 100, 2),
    ]).flat();
    expect(quickChips(many, now)).toHaveLength(6);
  });
});
