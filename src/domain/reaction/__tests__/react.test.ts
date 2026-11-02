import { describe, expect, it } from '@jest/globals';

import { Entry, toDateKey } from '@/domain/entries';
import { rng } from '@/domain/random';

import { NewEntry, planReaction, ReactContext } from '../react';

const now = new Date(2026, 10, 10, 15);
const DAY = 24 * 3600 * 1000;

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
  ledger: [],
  character: { installedAt: now.getTime() - 30 * DAY, lastCrackAt: null, lastCallAt: null },
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

  it('remembers a broken promise and calls about it', () => {
    const promise = {
      id: 'p1',
      tag: 'promise_never_again',
      category: 'shopping',
      amountMinor: 9000,
      entryId: null,
      createdAt: now.getTime() - 2 * DAY,
      resolved: null,
      resolvedAt: null,
    };
    const shoes = { ...latte, category: 'shopping', amountMinor: 25000 };
    const r = planReaction(shoes, ctx({ ledger: [promise] }));
    expect(r.tier).toBe('meltdown');
    expect(r.reasons).toContain('brokenPromise');
    expect(r.call?.scriptId).toBe('call_broken_promise');
    expect(r.call?.lines.join(' ')).toContain('Sunday'); // Nov 8, 2026
    expect(r.ledgerEvents).toEqual([{ id: 'p1', resolved: 'broken' }]);
    // A small treat in that category is still angry, not a meltdown.
    expect(planReaction({ ...shoes, amountMinor: 500 }, ctx({ ledger: [promise] })).tier).toBe(
      'angry',
    );
  });

  it('holds back escalation in the first three days', () => {
    const fresh = { installedAt: now.getTime() - DAY, lastCrackAt: null, lastCallAt: null };
    const r = planReaction(latte, ctx({ entries: [past(199800)], character: fresh }));
    expect(r.tier).toBe('angry');
    expect(r.escalation).toBe('none');
    expect(r.call).toBeNull();
  });

  it('calls without cracking when the glass is cooling down', () => {
    const character = {
      installedAt: now.getTime() - 30 * DAY,
      lastCrackAt: now.getTime() - DAY,
      lastCallAt: null,
    };
    const r = planReaction(latte, ctx({ entries: [past(199800)], character }));
    expect(r.escalation).toBe('none');
    expect(r.call).not.toBeNull();
  });

  it('moves his mood', () => {
    expect(planReaction({ ...latte, type: 'saved' }, ctx()).moodDelta).toBe(8);
    expect(planReaction(latte, ctx({ entries: [past(199800)] })).moodDelta).toBe(-12);
    expect(planReaction(latte, ctx()).moodDelta).toBe(0);
  });
});
