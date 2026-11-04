import { describe, expect, it } from '@jest/globals';

import { evaluateTier, Tier, TierInput } from '../tier';

const base: TierInput = {
  type: 'expense',
  amountMinor: 650,
  kind: 'discretionary',
  limitMinor: 200000,
  spentBeforeMinor: 50000,
  daysLeft: 20,
  stats: { countLast48h: 0, countThisMonth: 0, monthTotalMinor: 0, avgMinor: null },
};

const tierOf = (over: Partial<TierInput>): Tier => evaluateTier({ ...base, ...over }).tier;

describe('evaluateTier', () => {
  const cases: [string, Partial<TierInput>, Tier][] = [
    ['saved money is always approved', { type: 'saved', spentBeforeMinor: 999999 }, 'approve'],
    ['skipping is always approved', { type: 'skipped' }, 'approve'],
    ['essentials are approved', { kind: 'essential', amountMinor: 8200 }, 'approve'],
    [
      'essentials over budget are still approved',
      { kind: 'essential', spentBeforeMinor: 250000 },
      'approve',
    ],
    [
      'a huge essential is at most neutral',
      { kind: 'essential', amountMinor: 90000, stats: { ...base.stats, avgMinor: 8000 } },
      'neutral',
    ],
    ['a small treat within budget is neutral', {}, 'neutral'],
    ['a big discretionary purchase is judged', { amountMinor: 25000 }, 'judge'],
    ['a second one in 48h is judged', { stats: { ...base.stats, countLast48h: 1 } }, 'judge'],
    ['a third one in 48h makes him angry', { stats: { ...base.stats, countLast48h: 2 } }, 'angry'],
    ['crossing 85% makes him angry', { spentBeforeMinor: 168000, amountMinor: 3000 }, 'angry'],
    [
      'the purchase that goes over budget is a meltdown',
      { spentBeforeMinor: 199000, amountMinor: 2000 },
      'meltdown',
    ],
    [
      'landing exactly on the limit is not over',
      { spentBeforeMinor: 199000, amountMinor: 1000 },
      'judge',
    ],
    ['a small one while already over makes him angry', { spentBeforeMinor: 210000 }, 'angry'],
    [
      'a big one while already over is a meltdown',
      { spentBeforeMinor: 210000, amountMinor: 30000 },
      'meltdown',
    ],
    [
      'late in the month and mostly spent is judged',
      { daysLeft: 5, spentBeforeMinor: 150000 },
      'judge',
    ],
    [
      'mixed categories never escalate past judge',
      { kind: 'mixed', spentBeforeMinor: 199000, amountMinor: 2000 },
      'judge',
    ],
    ['no budget, small purchase is neutral', { limitMinor: null }, 'neutral'],
    [
      'no budget, big purchase is still judged by your average',
      {
        limitMinor: null,
        amountMinor: 9000,
        stats: { ...base.stats, countThisMonth: 3, avgMinor: 600 },
      },
      'judge',
    ],
    ['no budget never melts down', { limitMinor: null, amountMinor: 900000 }, 'neutral'],
    [
      'a zero budget makes any treat a meltdown',
      { limitMinor: 0, spentBeforeMinor: 0 },
      'meltdown',
    ],
    [
      'saving while over budget is still approved',
      { type: 'saved', spentBeforeMinor: 250000, kind: 'mixed' },
      'approve',
    ],
    [
      'skipping while over budget is still approved',
      { type: 'skipped', spentBeforeMinor: 250000 },
      'approve',
    ],
    [
      'groceries at 99% are approved',
      { kind: 'essential', spentBeforeMinor: 198000, amountMinor: 8000 },
      'approve',
    ],
    [
      'medical bills over budget are approved',
      { kind: 'essential', spentBeforeMinor: 260000, amountMinor: 40000 },
      'approve',
    ],
    [
      'an essential at exactly 3x average is approved',
      { kind: 'essential', amountMinor: 3000, stats: { ...base.stats, avgMinor: 1000 } },
      'approve',
    ],
    [
      'a repeat that also crosses 85% is angry',
      { spentBeforeMinor: 168000, amountMinor: 3000, stats: { ...base.stats, countLast48h: 1 } },
      'angry',
    ],
    [
      'three repeats while over budget stays angry',
      { spentBeforeMinor: 210000, stats: { ...base.stats, countLast48h: 2 } },
      'angry',
    ],
    [
      'a big purchase that pushes over is a meltdown',
      { spentBeforeMinor: 150000, amountMinor: 60000 },
      'meltdown',
    ],
    ['late month with plenty left is neutral', { daysLeft: 3, spentBeforeMinor: 20000 }, 'neutral'],
    [
      'mixed category when over budget is judged',
      { kind: 'mixed', spentBeforeMinor: 210000, amountMinor: 30000 },
      'judge',
    ],
    ['first purchase of the month is neutral', { spentBeforeMinor: 0 }, 'neutral'],
  ];

  it.each(cases)('%s', (_name, over, expected) => {
    expect(tierOf(over)).toBe(expected);
  });

  it('reports why', () => {
    expect(
      evaluateTier({ ...base, spentBeforeMinor: 199000, amountMinor: 2000 }).reasons,
    ).toContain('pushedOverBudget');
    expect(evaluateTier({ ...base, limitMinor: null }).reasons).toEqual(['noBudget']);
  });
});

describe('underBudget', () => {
  const base = {
    amountMinor: 1000,
    kind: 'essential' as const,
    limitMinor: 10000,
    daysLeft: 20,
    stats: { avgMinor: null, countThisMonth: 0, countLast48h: 0, monthTotalMinor: 0 },
  };
  const reasons = (over: Partial<Parameters<typeof evaluateTier>[0]>) =>
    evaluateTier({ type: 'expense', spentBeforeMinor: 0, ...base, ...over }).reasons;

  it('is only given when the month is really within the limit', () => {
    expect(reasons({ spentBeforeMinor: 1000 })).toContain('underBudget');
    expect(reasons({ type: 'saved', spentBeforeMinor: 1000 })).toContain('underBudget');
    expect(reasons({ spentBeforeMinor: 9500 })).not.toContain('underBudget');
    expect(reasons({ type: 'skipped', spentBeforeMinor: 20000 })).not.toContain('underBudget');
    expect(reasons({ limitMinor: null })).not.toContain('underBudget');
  });
});

describe('category limits', () => {
  const limited = (over: Partial<TierInput>) =>
    evaluateTier({ ...base, categoryLimitMinor: 20000, ...over });

  it('reacts to groceries by how far over the line they are', () => {
    const groceries = { kind: 'essential' as const };
    expect(limited({ ...groceries, amountMinor: 15000 }).tier).toBe('approve');
    expect(limited({ ...groceries, amountMinor: 30000 }).tier).toBe('judge');
    expect(limited({ ...groceries, amountMinor: 100000 }).tier).toBe('angry');
    expect(limited({ ...groceries, amountMinor: 200000 }).tier).toBe('meltdown');
  });

  it('gives the reasons for it', () => {
    expect(limited({ amountMinor: 30000 }).reasons).toContain('overLimit');
    expect(limited({ amountMinor: 100000 }).reasons).toContain('wayOverLimit');
    expect(limited({ amountMinor: 200000 }).reasons).toContain('absurdOverLimit');
  });

  it('works for wants too', () => {
    expect(limited({ amountMinor: 100000 }).tier).toBe('angry');
    expect(limited({ amountMinor: 200000 }).tier).toBe('meltdown');
    expect(limited({ amountMinor: 1000, categoryLimitMinor: 800 }).tier).toBe('judge');
  });

  it("never goes past a category's ceiling", () => {
    const health = { kind: 'essential' as const, maxTier: 'judge' as const };
    expect(limited({ ...health, amountMinor: 900000 }).tier).toBe('judge');
    expect(limited({ kind: 'discretionary', maxTier: 'judge', amountMinor: 900000 }).tier).toBe(
      'judge',
    );
  });

  it("lets 'other' get angry, but not come through the glass", () => {
    expect(limited({ kind: 'mixed', amountMinor: 900000 }).tier).toBe('angry');
  });

  it('notices small purchases adding up over the month', () => {
    const stats = { ...base.stats, monthTotalMinor: 4500 };
    const coffee = limited({ amountMinor: 600, categoryLimitMinor: 800, stats });
    expect(coffee.tier).toBe('judge');
    expect(coffee.reasons).toContain('heavyMonth');
    const groceries = limited({
      kind: 'essential',
      amountMinor: 600,
      categoryLimitMinor: 800,
      stats,
    });
    expect(groceries.tier).toBe('judge');
  });

  it('leaves medical costs out of that', () => {
    const stats = { ...base.stats, monthTotalMinor: 900000 };
    const r = limited({ kind: 'essential', maxTier: 'judge', amountMinor: 1000, stats });
    expect(r.tier).toBe('approve');
    expect(r.reasons).not.toContain('heavyMonth');
  });
});
