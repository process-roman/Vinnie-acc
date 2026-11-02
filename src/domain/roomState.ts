// The office as a budget display (blueprint §3): derived from entries and the
// budget every time, never stored.

import { Entry, toDateKey, toMonthKey } from './entries';
import { Tier } from './reaction/tier';

export type PlantState = 'healthy' | 'droopy' | 'wilted' | 'dead';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm';
export type PosterState = 'intact' | 'cracked';
export type CatState = 'sleeping' | 'sitting' | 'hiding';

export type RoomState = {
  plant: PlantState;
  weather: Weather;
  poster: PosterState;
  /** Crumpled receipts by the bin: one per expense this month, capped for drawing. */
  receipts: number;
  espressoSteaming: boolean;
  cat: CatState;
  /** Consecutive days with at least one entry, ending today or yesterday. */
  streak: number;
};

export const MAX_PILE = 14;
/** A reaction this recent and this angry still has Vinnie worked up. */
export const UPSET_WINDOW_MS = 2 * 3600 * 1000;
const UPSET: readonly Tier[] = ['angry', 'meltdown'];

export function plantFor(share: number | null): PlantState {
  if (share === null || share < 0.6) return 'healthy';
  if (share < 0.85) return 'droopy';
  if (share <= 1) return 'wilted';
  return 'dead';
}

export function weatherFor(share: number | null): Weather {
  if (share === null || share < 0.6) return 'sunny';
  if (share < 0.85) return 'cloudy';
  if (share <= 1) return 'rain';
  return 'storm';
}

export function trackingStreak(entries: readonly { date: string }[], now: Date): number {
  const days = new Set(entries.map((e) => e.date));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Today not logged yet doesn't break the streak; it starts from yesterday.
  if (!days.has(toDateKey(day))) day.setDate(day.getDate() - 1);
  let n = 0;
  while (days.has(toDateKey(day))) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

export function roomState(
  entries: readonly (Entry & { tier?: Tier | null })[],
  limitMinor: number | null,
  now: Date,
): RoomState {
  const month = toMonthKey(now);
  const expenses = entries.filter((e) => e.type === 'expense' && toMonthKey(e.date) === month);
  const spent = expenses.reduce((s, e) => s + e.amountMinor, 0);
  const share =
    limitMinor === null ? null : limitMinor === 0 ? (spent > 0 ? 2 : 0) : spent / limitMinor;

  const latest = entries.reduce<(typeof entries)[number] | null>(
    (a, e) => (!a || e.createdAt > a.createdAt ? e : a),
    null,
  );
  const upset =
    !!latest?.tier &&
    UPSET.includes(latest.tier) &&
    now.getTime() - latest.createdAt < UPSET_WINDOW_MS;
  const streak = trackingStreak(entries, now);

  return {
    plant: plantFor(share),
    weather: weatherFor(share),
    poster: share !== null && share > 1 ? 'cracked' : 'intact',
    receipts: Math.min(MAX_PILE, expenses.length),
    espressoSteaming: !upset,
    cat: upset ? 'hiding' : streak >= 2 ? 'sleeping' : 'sitting',
    streak,
  };
}
