// Fixing the cracked glass (blueprint §4.4, changed by the owner: see DECISIONS.md).
// Three ways: a good day takes it down a level, his mood recovering mends it, or coins.

import { toDateKey } from './entries';
import { moodState } from './mood';
import type { Tier } from './reaction/tier';

/** How good his mood has to get for the glass to mend on its own. */
const MOOD_FIXES = 55;

export type CrackLevel = 0 | 1 | 2 | 3;

export type CrackState = {
  level: CrackLevel;
  /** When the glass last cracked (or got worse). */
  lastCrackAt: number | null;
  /** The last day (YYYY-MM-DD) a repair happened, so it's once a day. */
  lastRepairDay: string | null;
};

export const NO_CRACK: CrackState = { level: 0, lastCrackAt: null, lastRepairDay: null };

export function crackWorse(c: CrackState, now: number): CrackState {
  return { ...c, level: Math.min(3, c.level + 1) as CrackLevel, lastCrackAt: now };
}

/**
 * True when today qualifies for a repair: there's a crack, you logged something
 * today, today isn't the day it cracked or already repaired, and nothing today
 * was a meltdown.
 */
export function repairDue(
  c: CrackState,
  entries: readonly { date: string; tier?: Tier | null }[],
  now: Date,
): boolean {
  if (c.level === 0 || c.lastCrackAt === null) return false;
  const today = toDateKey(now);
  if (c.lastRepairDay === today) return false;
  if (toDateKey(new Date(c.lastCrackAt)) === today) return false;
  const todays = entries.filter((e) => e.date === today);
  return todays.length > 0 && !todays.some((e) => e.tier === 'meltdown');
}

export function repairOnce(c: CrackState, now: Date): CrackState {
  return {
    ...c,
    level: Math.max(0, c.level - 1) as CrackLevel,
    lastRepairDay: toDateKey(now),
  };
}

const MOOD_RANK = ['meltdown', 'angry', 'suspicious', 'relaxed', 'proud'] as const;

/**
 * The glass also mends when he cheers up: once his mood climbs to relaxed or better,
 * from the lowest it has been since the crack. Climbing, not just being there, so a
 * crack from a good mood doesn't vanish the moment the call ends.
 */
export function moodMends(lowestSinceCrack: number, mood: number): boolean {
  const rank = (m: number) => MOOD_RANK.indexOf(moodState(m));
  return rank(mood) >= rank(MOOD_FIXES) && rank(mood) > rank(lowestSinceCrack);
}
