import { describe, expect, it } from '@jest/globals';

import { Entry, toDateKey } from '../entries';
import {
  backedOff,
  DEFAULT_PREFS,
  inQuietHours,
  NotificationLogItem,
  PlanInput,
  planNotifications,
} from '../notifications';
import { LedgerEntry } from '../reaction/ledger';
import { redactAmounts, shareCardContent } from '../shareCard';
import { sitdownAvailable, weekEnd, weeklyReview, weekStart } from '../sitdown';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
// Monday, Nov 16 2026, 10:00.
const MONDAY = new Date(2026, 10, 16, 10);

let n = 0;
const e = (date: string, over: Partial<Entry & { tier: string | null }> = {}) =>
  ({
    id: `e${n++}`,
    type: 'expense',
    amountMinor: 1000,
    category: 'coffee',
    description: '',
    date,
    createdAt: new Date(`${date}T12:00:00`).getTime(),
    tier: null,
    ...over,
  }) as Entry & { tier: null };

const plan = (over: Partial<PlanInput> = {}) =>
  planNotifications({
    prefs: { ...DEFAULT_PREFS, enabled: true },
    entries: [e(toDateKey(MONDAY))],
    limitMinor: 200000,
    now: MONDAY,
    log: [],
    lastCallAt: null,
    ...over,
  });

describe('notification plan (blueprint 7.1)', () => {
  it('is opt-in', () => {
    expect(plan({ prefs: DEFAULT_PREFS })).toEqual([]);
  });

  it('never schedules two on the same day, or in quiet hours', () => {
    const p = plan();
    const days = p.map((x) => toDateKey(new Date(x.at)));
    expect(new Set(days).size).toBe(days.length);
    for (const x of p) expect(inQuietHours(new Date(x.at).getHours(), DEFAULT_PREFS)).toBe(false);
  });

  it('plans the Sunday sit-down, a weekly call and a quiet nudge', () => {
    const kinds = plan().map((x) => x.kind);
    expect(kinds).toContain('sitdown');
    expect(kinds).toContain('proactive_call');
    expect(kinds).toContain('quiet_nudge');
    expect(new Date(plan().find((x) => x.kind === 'sitdown')!.at).getDay()).toBe(0);
  });

  it('warns late in the month only when 85% is gone with a week left', () => {
    const heavy = [e('2026-11-02', { amountMinor: 180000 })];
    expect(plan({ entries: heavy }).map((x) => x.kind)).toContain('late_month');
    expect(plan().map((x) => x.kind)).not.toContain('late_month');
  });

  it('skips the call if he called recently or already called this week', () => {
    expect(plan({ lastCallAt: MONDAY.getTime() + 2 * DAY }).map((x) => x.kind)).not.toContain(
      'proactive_call',
    );
    const log: NotificationLogItem[] = [
      { kind: 'proactive_call', at: MONDAY.getTime() - 2 * DAY, opened: true },
    ];
    expect(plan({ log }).map((x) => x.kind)).not.toContain('proactive_call');
  });

  it('backs off to every other day after 3 ignored', () => {
    const ignored: NotificationLogItem[] = [1, 2, 3].map((d) => ({
      kind: 'quiet_nudge',
      at: MONDAY.getTime() - d * DAY,
      opened: false,
    }));
    expect(backedOff(ignored, MONDAY.getTime())).toBe(true);
    expect(
      backedOff([...ignored.slice(1), { ...ignored[0], opened: true }], MONDAY.getTime()),
    ).toBe(false);
    const slow = plan({ log: ignored });
    for (const x of slow) {
      const dayIndex = Math.round(
        (new Date(x.at).setHours(0, 0, 0, 0) - new Date(MONDAY).setHours(0, 0, 0, 0)) / DAY,
      );
      expect(dayIndex % 2).toBe(0);
    }
  });

  it('handles quiet hours that wrap midnight', () => {
    expect(inQuietHours(23, DEFAULT_PREFS)).toBe(true);
    expect(inQuietHours(3, DEFAULT_PREFS)).toBe(true);
    expect(inQuietHours(9, DEFAULT_PREFS)).toBe(false);
    expect(inQuietHours(13, { enabled: true, quietStart: 12, quietEnd: 14 })).toBe(true);
  });
});

describe('weekly sit-down (blueprint 7.2)', () => {
  it('uses Monday-to-Sunday weeks', () => {
    expect(weekStart(MONDAY)).toBe('2026-11-16');
    expect(weekStart(new Date(2026, 10, 22, 20))).toBe('2026-11-16'); // Sunday
    expect(weekEnd(MONDAY)).toBe('2026-11-22');
  });

  it("matches History's totals for the week exactly", () => {
    const entries = [
      e('2026-11-15', { amountMinor: 99999 }), // previous week
      e('2026-11-16', { amountMinor: 650 }),
      e('2026-11-18', { amountMinor: 2500, category: 'dining', tier: 'angry' as never }),
      e('2026-11-19', { amountMinor: 8000, category: 'groceries' }),
      e('2026-11-20', { amountMinor: 5000, type: 'saved', category: 'other' }),
      e('2026-11-23', { amountMinor: 77777 }), // next week
    ];
    const r = weeklyReview(entries, [], MONDAY);
    expect(r.spentMinor).toBe(650 + 2500 + 8000);
    expect(r.count).toBe(4);
    expect(r.topCategory).toEqual({ category: 'groceries', totalMinor: 8000 });
    expect(r.best?.type).toBe('saved');
    expect(r.worst?.category).toBe('dining');
    expect(r.savedMinor).toBe(5000);
  });

  it('counts promises resolved this week', () => {
    const l = (resolved: 'kept' | 'broken', resolvedAt: number): LedgerEntry => ({
      id: String(resolvedAt),
      tag: 'promise_never_again',
      category: 'shopping',
      amountMinor: 1,
      entryId: null,
      createdAt: 0,
      resolved,
      resolvedAt,
    });
    const r = weeklyReview(
      [],
      [
        l('kept', MONDAY.getTime()),
        l('broken', MONDAY.getTime() + DAY),
        l('kept', MONDAY.getTime() - 3 * DAY),
      ],
      MONDAY,
    );
    expect([r.promisesKept, r.promisesBroken]).toEqual([1, 1]);
  });

  it('opens Friday to Sunday, once a week', () => {
    expect(sitdownAvailable(MONDAY, new Set())).toBe(false);
    const friday = new Date(2026, 10, 20, 18);
    expect(sitdownAvailable(friday, new Set())).toBe(true);
    expect(sitdownAvailable(friday, new Set(['2026-11-16']))).toBe(false);
  });
});

describe('share cards (blueprint 7.3)', () => {
  const crack = {
    kind: 'crack' as const,
    line: 'Over budget AND $300?! That is it.',
    amountMinor: 30000,
    description: 'Sneakers',
    category: 'shopping',
  };

  it('never shows amounts or descriptions unless switched on', () => {
    const c = shareCardContent(crack, { showAmount: false, showDescription: false });
    expect(JSON.stringify(c)).not.toMatch(/300|Sneakers/);
    expect(c.detail).toBeNull();
  });

  it('shows them when asked', () => {
    const c = shareCardContent(crack, { showAmount: true, showDescription: true });
    expect(c.detail).toBe('Sneakers · $300.00');
    expect(c.quote).toContain('$300');
  });

  it('redacts any dollar figure', () => {
    expect(redactAmounts('$6.50 for coffee and $1,299 for a TV')).toBe(
      '$$$ for coffee and $$$ for a TV',
    );
  });
});
