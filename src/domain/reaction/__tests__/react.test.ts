import { describe, expect, it } from '@jest/globals';

import { Entry, toDateKey } from '@/domain/entries';
import { rng } from '@/domain/random';

import { NewEntry, planReaction, ReactContext } from '../react';

const now = new Date(2026, 10, 10, 15);

const past = (amountMinor: number, category = 'groceries'): Entry => ({
  id: `${category}-${amountMinor}`,
  type: 'expense',
  amountMinor,
  category,
  description: '',
  date: toDateKey(now),
  createdAt: now.getTime() - 5 * 24 * 3600 * 1000,
});

const ctx = (over: Partial<ReactContext> = {}): ReactContext => ({
  entries: [],
  limitMinor: 200000,
  heat: 'classic',
  currency: 'USD',
  recentLineIds: [],
  now,
  rand: rng(7),
  ...over,
});

const latte: NewEntry = {
  type: 'expense',
  amountMinor: 650,
  category: 'coffee',
  description: 'latte',
};

describe('planReaction', () => {
  it('reacts to a normal purchase with no escalation', () => {
    const r = planReaction(latte, ctx());
    expect(r.tier).toBe('neutral');
    expect(r.escalation).toBe('none');
    expect(r.call).toBeNull();
    expect(r.line).not.toMatch(/[{}]/);
  });

  it('punches and calls when a purchase goes over budget', () => {
    const r = planReaction(latte, ctx({ entries: [past(199800)] }));
    expect(r.tier).toBe('meltdown');
    expect(r.escalation).toBe('punch');
    expect(r.call?.scriptId).toBe('call_over_budget');
    expect(r.call?.lines.join(' ')).toContain('$6.50');
    expect(r.call?.replies).toHaveLength(3);
  });

  it('knocks instead of punching at gentle heat', () => {
    const r = planReaction(latte, ctx({ entries: [past(199800)], heat: 'gentle' }));
    expect(r.escalation).toBe('knock');
    expect(r.call).not.toBeNull();
  });

  it('only quotes real numbers', () => {
    const r = planReaction(
      { ...latte, amountMinor: 25000, category: 'shopping' },
      ctx({ entries: [past(10000)] }),
    );
    expect(r.tier).toBe('judge');
    expect(r.line).toContain('$250');
  });

  it('never escalates on essentials', () => {
    const r = planReaction(
      { ...latte, category: 'bills', amountMinor: 150000 },
      ctx({ entries: [past(199800)] }),
    );
    expect(r.tier).toBe('approve');
    expect(r.escalation).toBe('none');
  });
});
