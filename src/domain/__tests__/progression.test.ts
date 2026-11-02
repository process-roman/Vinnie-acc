import { describe, expect, it } from '@jest/globals';

import {
  ACHIEVEMENTS,
  AchievementEvent,
  AchievementId,
  derivedProgress,
  lastMonthUnderControl,
  longestStreak,
  updateAchievements,
} from '../achievements';
import {
  balance,
  CoinGrant,
  dayKey,
  entryKey,
  grantsForEntry,
  reversalForDeletedEntry,
} from '../coins';
import { Entry } from '../entries';
import { canBuy, equip, equippedBySlot, GIFTS, ITEMS } from '../shop';

let n = 0;
const e = (date: string, over: Partial<Entry> = {}): Entry => ({
  id: `e${n++}`,
  type: 'expense',
  amountMinor: 500,
  category: 'coffee',
  description: '',
  date,
  createdAt: new Date(`${date}T15:00:00`).getTime(),
  ...over,
});

/** Logs entries one by one the way the app does, collecting grants. */
function logAll(entries: Entry[]): CoinGrant[] {
  const grants: CoinGrant[] = [];
  entries.forEach((entry, i) => {
    const keys = new Set(grants.map((g) => g.key));
    grants.push(...grantsForEntry(entry, entries.slice(0, i), keys));
  });
  return grants;
}

describe('coins (blueprint 6.1)', () => {
  it('pays once per tracking day', () => {
    const grants = logAll([e('2026-11-01'), e('2026-11-01'), e('2026-11-02')]);
    expect(grants.map((g) => g.key)).toEqual([dayKey('2026-11-01'), dayKey('2026-11-02')]);
    expect(balance(grants)).toBe(10);
  });

  it('never pays for spending more', () => {
    const big = logAll([e('2026-11-01', { amountMinor: 999999 })]);
    const small = logAll([e('2026-11-01', { amountMinor: 1 })]);
    expect(balance(big)).toBe(balance(small));
  });

  it('pays for savings and skips, at most twice a day', () => {
    const saves = [1, 2, 3].map(() => e('2026-11-01', { type: 'saved' as const }));
    const grants = logAll(saves);
    expect(grants.filter((g) => g.key.startsWith('entry:'))).toHaveLength(2);
    expect(balance(grants)).toBe(5 + 10);
  });

  it('pays a seven-day streak once', () => {
    const days = Array.from({ length: 9 }, (_, i) => e(`2026-11-0${i + 1}`));
    const grants = logAll(days);
    expect(grants.filter((g) => g.key.startsWith('streak7:'))).toHaveLength(1);
  });

  it('does not double-grant under repeated calls (idempotency)', () => {
    const entry = e('2026-11-05', { type: 'skipped' });
    const first = grantsForEntry(entry, [], new Set());
    const again = grantsForEntry(entry, [], new Set(first.map((g) => g.key)));
    expect(again).toEqual([]);
  });

  it('takes back entry coins when deleted the same day only', () => {
    const save = e('2026-11-05', { type: 'saved' });
    const grants = grantsForEntry(save, [], new Set());
    const back = reversalForDeletedEntry(save, grants, '2026-11-05');
    expect(back).toEqual({
      key: `reverse:${entryKey(save.id)}`,
      delta: -5,
      reason: 'Entry deleted',
    });
    expect(reversalForDeletedEntry(save, [...grants, back!], '2026-11-05')).toBeNull();
    expect(reversalForDeletedEntry(save, grants, '2026-11-06')).toBeNull();
  });
});

describe('achievements (blueprint 6.2)', () => {
  it('has the blueprint list', () => {
    expect(ACHIEVEMENTS).toHaveLength(13);
    expect(ACHIEVEMENTS.filter((a) => a.secret).map((a) => a.id)).toEqual(['secret']);
  });

  it('counts streaks softly: a gap pauses, the best run counts', () => {
    expect(
      longestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06']),
    ).toBe(3);
    expect(longestStreak([])).toBe(0);
  });

  it('every achievement is reachable', () => {
    const days = Array.from({ length: 7 }, (_, i) => e(`2026-11-0${i + 1}`));
    const entries = [
      ...days,
      e('2026-11-02', { type: 'saved' }),
      e('2026-11-03', { type: 'skipped' }),
      e('2026-11-04', { description: 'Bagel and coffee' }),
    ];
    const events: AchievementEvent[] = [
      'answered',
      'glass',
      'apology',
      'first_gift',
      'sitdown',
      'repaired',
      'under_control',
    ];
    const progress = {
      ...derivedProgress(entries),
      ...Object.fromEntries(events.map((ev) => [ev, 1])),
    } as Record<AchievementId, number>;
    const { unlocked } = updateAchievements({}, progress, 1);
    expect(unlocked.map((a) => a.id).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  it('unlocks once and never goes backwards', () => {
    const one = updateAchievements({}, { paper_trail: 5 }, 10);
    expect(one.unlocked.map((a) => a.id)).toEqual(['paper_trail']);
    const two = updateAchievements(one.state, { paper_trail: 2 }, 20);
    expect(two.unlocked).toEqual([]);
    expect(two.state.paper_trail).toEqual({ progress: 5, unlockedAt: 10 });
  });

  it('finds a breakfast for the secret', () => {
    expect(derivedProgress([e('2026-11-01', { description: 'Pancakes' })]).secret).toBe(1);
    const morning = e('2026-11-01', { createdAt: new Date('2026-11-01T08:30:00').getTime() });
    expect(derivedProgress([morning]).secret).toBe(1);
    expect(derivedProgress([e('2026-11-01')]).secret).toBe(0);
  });

  it('checks the month that just ended', () => {
    const now = new Date(2026, 10, 2);
    const oct = [e('2026-10-10', { amountMinor: 50000 })];
    expect(lastMonthUnderControl(oct, 100000, now)).toBe(true);
    expect(lastMonthUnderControl(oct, 40000, now)).toBe(false);
    expect(lastMonthUnderControl([], 100000, now)).toBe(false);
    expect(lastMonthUnderControl(oct, null, now)).toBe(false);
  });
});

describe('shop (blueprint 6.3)', () => {
  it('has gifts and office items with prices', () => {
    expect(GIFTS.length).toBeGreaterThanOrEqual(4);
    expect(ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const g of [...GIFTS, ...ITEMS]) expect(g.price).toBeGreaterThan(0);
  });

  it("won't let coins go below zero or buy an item twice", () => {
    expect(canBuy('pizza', 29, [])).toEqual({ ok: false, reason: 'not_enough_coins' });
    expect(canBuy('pizza', 30, [])).toEqual({ ok: true, cost: 30 });
    expect(canBuy('rug', 999, [{ itemId: 'rug', equipped: true }])).toEqual({
      ok: false,
      reason: 'already_owned',
    });
    // Gifts can be bought again and again.
    expect(canBuy('pizza', 30, [{ itemId: 'pizza', equipped: false }]).ok).toBe(true);
    expect(canBuy('yacht', 1e9, []).ok).toBe(false);
  });

  it('keeps one item per slot', () => {
    let owned = [
      { itemId: 'blue_tie', equipped: true },
      { itemId: 'sunday_vest', equipped: false },
      { itemId: 'rug', equipped: true },
    ];
    owned = equip(owned, 'sunday_vest', true);
    expect(equippedBySlot(owned)).toEqual({ outfit: 'sunday_vest', floor: 'rug' });
    owned = equip(owned, 'rug', false);
    expect(equippedBySlot(owned)).toEqual({ outfit: 'sunday_vest' });
  });
});
