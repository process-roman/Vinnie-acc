// Cracks heal through behaviour, not coins (blueprint §4.4): every day you log
// something without setting him off takes the crack down a level.

import { toDateKey } from './entries';
import type { Tier } from './reaction/tier';

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
