// Coins (blueprint §8): in-game only, no real-money value, never for spending more.
// Every grant has an idempotency key, so nothing is ever granted twice.

import type { Entry } from './entries';
import { trackingStreak } from './roomState';

export type CoinGrant = { key: string; delta: number; reason: string };

export const TRACKING_DAY_COINS = 5;
export const SAVE_SKIP_COINS = 5;
export const SAVE_SKIP_DAILY_CAP = 2;
export const STREAK_DAYS = 7;
export const STREAK_COINS = 30;

export const dayKey = (date: string) => `day:${date}`;
export const entryKey = (id: string) => `entry:${id}`;
const reverseKey = (key: string) => `reverse:${key}`;

/**
 * Coins earned by logging `entry`, given everything logged before it and the keys
 * already granted. Spending more never earns anything.
 */
export function grantsForEntry(
  entry: Entry,
  before: readonly Entry[],
  granted: ReadonlySet<string>,
): CoinGrant[] {
  const grants: CoinGrant[] = [];
  // First thing logged on a day: a tracking day.
  if (!granted.has(dayKey(entry.date)) && !before.some((e) => e.date === entry.date)) {
    grants.push({ key: dayKey(entry.date), delta: TRACKING_DAY_COINS, reason: 'Tracking day' });
  }
  // Saving or walking away, a couple of times a day at most.
  if (entry.type !== 'expense' && !granted.has(entryKey(entry.id))) {
    const rewardedToday = before.filter(
      (e) => e.type !== 'expense' && e.date === entry.date && granted.has(entryKey(e.id)),
    ).length;
    if (rewardedToday < SAVE_SKIP_DAILY_CAP) {
      grants.push({
        key: entryKey(entry.id),
        delta: SAVE_SKIP_COINS,
        reason: entry.type === 'saved' ? 'Saved money' : 'Walked away',
      });
    }
  }
  // Seven tracked days in a row (soft streak: a gap pauses it, nothing is taken away).
  const all = [...before, entry];
  const streak = trackingStreak(all, new Date(`${entry.date}T12:00:00`));
  if (streak >= STREAK_DAYS) {
    const start = new Date(`${entry.date}T12:00:00`);
    start.setDate(start.getDate() - (streak - 1));
    const key = `streak7:${start.toISOString().slice(0, 10)}`;
    if (!granted.has(key)) {
      grants.push({ key, delta: STREAK_COINS, reason: 'Seven-day streak' });
    }
  }
  return grants;
}

/**
 * Deleting an entry on the day it was logged takes back the coins it earned
 * (blueprint 6.1); after that day, coins stay earned.
 */
export function reversalForDeletedEntry(
  entry: Entry,
  grants: readonly CoinGrant[],
  today: string,
): CoinGrant | null {
  if (entry.date !== today) return null;
  const original = grants.find((g) => g.key === entryKey(entry.id));
  if (!original || grants.some((g) => g.key === reverseKey(original.key))) return null;
  return { key: reverseKey(original.key), delta: -original.delta, reason: 'Entry deleted' };
}

export function balance(grants: readonly CoinGrant[]): number {
  return grants.reduce((s, g) => s + g.delta, 0);
}
