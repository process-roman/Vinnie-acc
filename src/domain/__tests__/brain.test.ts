import { describe, expect, it } from '@jest/globals';

import { toDateKey } from '../entries';
import { clampMood, driftMood, moodState } from '../mood';
import {
  CALL_COOLDOWN_MS,
  CRACK_COOLDOWN_MS,
  decideEscalation,
  EscalationInput,
  HONEYMOON_MS,
} from '../reaction/escalation';
import { checkLedger, keptPromises, LedgerEntry } from '../reaction/ledger';
import { crackWorse, NO_CRACK, repairDue, repairOnce } from '../repair';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 10, 20, 15).getTime();

describe('mood', () => {
  it('maps to the blueprint states', () => {
    expect([100, 80, 79, 55, 54, 35, 34, 15, 14, 0].map(moodState)).toEqual([
      'proud',
      'proud',
      'relaxed',
      'relaxed',
      'suspicious',
      'suspicious',
      'angry',
      'angry',
      'meltdown',
      'meltdown',
    ]);
  });

  it('clamps to 0..100', () => {
    expect(clampMood(-20)).toBe(0);
    expect(clampMood(140)).toBe(100);
  });

  it('drifts 2 points a day toward 50, keeping partial days', () => {
    expect(driftMood(30, NOW - 3 * DAY - HOUR, NOW)).toEqual({ mood: 36, at: NOW - HOUR });
    expect(driftMood(70, NOW - 2 * DAY, NOW).mood).toBe(66);
    expect(driftMood(50, NOW - 9 * DAY, NOW).mood).toBe(50);
    expect(driftMood(51, NOW - 9 * DAY, NOW).mood).toBe(50); // never overshoots
    expect(driftMood(20, NOW - HOUR, NOW)).toEqual({ mood: 20, at: NOW - HOUR });
  });
});

describe('escalation cooldowns (blueprint §7.3)', () => {
  const base: EscalationInput = {
    tier: 'meltdown',
    heat: 'classic',
    now: NOW,
    installedAt: NOW - 10 * DAY,
    lastCrackAt: null,
    lastCallAt: null,
  };

  it('punches and calls on a fresh meltdown', () => {
    expect(decideEscalation(base)).toEqual({ glass: 'punch', call: true, held: false });
  });

  it('only escalates meltdowns', () => {
    expect(decideEscalation({ ...base, tier: 'angry' })).toEqual({
      glass: 'none',
      call: false,
      held: false,
    });
  });

  it('knocks at Gentle heat', () => {
    expect(decideEscalation({ ...base, heat: 'gentle' }).glass).toBe('knock');
  });

  it('cracks at most every 48 hours', () => {
    const recent = { ...base, lastCrackAt: NOW - CRACK_COOLDOWN_MS + HOUR };
    expect(decideEscalation(recent)).toMatchObject({ glass: 'none', call: true });
    expect(decideEscalation({ ...base, lastCrackAt: NOW - CRACK_COOLDOWN_MS }).glass).toBe('punch');
  });

  it('calls at most every 72 hours', () => {
    const recent = { ...base, lastCallAt: NOW - CALL_COOLDOWN_MS + HOUR };
    expect(decideEscalation(recent)).toMatchObject({ glass: 'punch', call: false });
  });

  it('holds back when both are cooling down', () => {
    expect(decideEscalation({ ...base, lastCrackAt: NOW - HOUR, lastCallAt: NOW - HOUR })).toEqual({
      glass: 'none',
      call: false,
      held: true,
    });
  });

  it('never escalates in the first three days', () => {
    const fresh = { ...base, installedAt: NOW - HONEYMOON_MS + HOUR };
    expect(decideEscalation(fresh)).toEqual({ glass: 'none', call: false, held: true });
    expect(decideEscalation({ ...base, installedAt: NOW - HONEYMOON_MS }).glass).toBe('punch');
  });
});

describe('promise ledger (blueprint §7.4)', () => {
  const promise = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
    id: 'p1',
    tag: 'promise_never_again',
    category: 'shopping',
    amountMinor: 12000,
    entryId: null,
    createdAt: NOW - 2 * DAY,
    resolved: null,
    resolvedAt: null,
    ...over,
  });

  it('breaks a promise on the same category within 7 days', () => {
    const r = checkLedger([promise()], { type: 'expense', category: 'shopping' }, NOW);
    expect(r.reasons).toContain('brokenPromise');
    expect(r.events).toEqual([{ id: 'p1', resolved: 'broken' }]);
    expect(r.brokenPromise?.id).toBe('p1');
  });

  it('ignores other categories, savings, old and resolved promises', () => {
    const cases = [
      checkLedger([promise()], { type: 'expense', category: 'coffee' }, NOW),
      checkLedger([promise()], { type: 'saved', category: 'shopping' }, NOW),
      checkLedger(
        [promise({ createdAt: NOW - 8 * DAY })],
        { type: 'expense', category: 'shopping' },
        NOW,
      ),
      checkLedger(
        [promise({ resolved: 'broken' })],
        { type: 'expense', category: 'shopping' },
        NOW,
      ),
    ];
    for (const r of cases) expect(r.reasons).not.toContain('brokenPromise');
  });

  it('remembers an "investment" excuse for 30 days', () => {
    const inv = promise({ tag: 'excuse_investment', createdAt: NOW - 20 * DAY });
    expect(checkLedger([inv], { type: 'expense', category: 'games' }, NOW).reasons).toEqual([
      'investmentAgain',
    ]);
    const old = promise({ tag: 'excuse_investment', createdAt: NOW - 31 * DAY });
    expect(checkLedger([old], { type: 'expense', category: 'games' }, NOW).reasons).toEqual([]);
  });

  it('finds promises kept for a full week', () => {
    const p = promise({ createdAt: NOW - 7 * DAY });
    expect(keptPromises([p], [], NOW).map((l) => l.id)).toEqual(['p1']);
    const relapse = { type: 'expense' as const, category: 'shopping', createdAt: NOW - DAY };
    expect(keptPromises([p], [relapse], NOW)).toEqual([]);
    expect(keptPromises([promise()], [], NOW)).toEqual([]); // not a week yet
  });
});

describe('repair (blueprint §4.4)', () => {
  const today = new Date(NOW);
  const day = (offset: number) => toDateKey(new Date(NOW + offset * DAY));
  const cracked = crackWorse(NO_CRACK, NOW - 2 * DAY);

  it('escalates one level per crack, up to 3', () => {
    let c = NO_CRACK;
    for (let i = 0; i < 5; i++) c = crackWorse(c, NOW);
    expect(c.level).toBe(3);
  });

  it('repairs a level on a later day with an entry and no meltdown', () => {
    expect(repairDue(cracked, [{ date: day(0), tier: 'neutral' }], today)).toBe(true);
    expect(repairOnce(cracked, today)).toMatchObject({ level: 0, lastRepairDay: day(0) });
  });

  it('needs an entry today', () => {
    expect(repairDue(cracked, [{ date: day(-1), tier: 'neutral' }], today)).toBe(false);
  });

  it('not on the day it cracked, or after a meltdown today', () => {
    const crackedToday = crackWorse(NO_CRACK, NOW - HOUR);
    expect(repairDue(crackedToday, [{ date: day(0), tier: 'neutral' }], today)).toBe(false);
    const entries = [
      { date: day(0), tier: 'neutral' as const },
      { date: day(0), tier: 'meltdown' as const },
    ];
    expect(repairDue(cracked, entries, today)).toBe(false);
  });

  it('once a day, so a full crack takes three good days', () => {
    let c = crackWorse(
      crackWorse(crackWorse(NO_CRACK, NOW - 5 * DAY), NOW - 5 * DAY),
      NOW - 5 * DAY,
    );
    const log: { date: string; tier: 'neutral' }[] = [];
    for (let d = -2; d <= 0; d++) {
      const date = new Date(NOW + d * DAY);
      log.push({ date: toDateKey(date), tier: 'neutral' });
      expect(repairDue(c, log, date)).toBe(true);
      c = repairOnce(c, date);
      expect(repairDue(c, log, date)).toBe(false);
    }
    expect(c.level).toBe(0);
  });
});
