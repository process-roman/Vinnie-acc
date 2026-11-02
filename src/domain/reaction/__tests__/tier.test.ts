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
