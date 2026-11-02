// Achievements (blueprint §8, 6.2). Some are derived from entries; others count
// events (calls answered, punches, gifts, repairs, sit-downs, good months).

import data from '@/content/achievements.json';

import { toDateKey } from './entries';
import type { Entry } from './entries';

export type AchievementId =
  | 'first_receipt'
  | 'answered'
  | 'glass'
  | 'apology'
  | 'paper_trail'
  | 'first_gift'
  | 'seven_sanity'
  | 'sitdown'
  | 'saver'
  | 'walked_away'
  | 'repaired'
  | 'under_control'
  | 'secret';

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  coins: number;
  goal: number;
  secret?: boolean;
};

export const ACHIEVEMENTS = data as Achievement[];
export const achievementById = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id)!;

/** Achievements that count things happening rather than reading entries. */
export type AchievementEvent =
  'answered' | 'glass' | 'apology' | 'first_gift' | 'sitdown' | 'repaired' | 'under_control';

const BREAKFAST = /breakfast|bagel|pancake|waffle|croissant|muffin|omelet|brunch|egg/i;

/** Longest run of consecutive tracked days (soft streak: a gap pauses, never erases). */
export function longestStreak(dates: readonly string[]): number {
  const days = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = new Date(`${d}T12:00:00`);
    const next = prev ? new Date(prev) : null;
    next?.setDate(next.getDate() + 1);
    run = next && toDateKey(next) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

/** Progress for the achievements that come straight from the entries. */
export function derivedProgress(entries: readonly Entry[]): Partial<Record<AchievementId, number>> {
  const expenses = entries.filter((e) => e.type === 'expense');
  // The secret: breakfast by name, or coffee or a meal out before 11 a.m.
  const breakfast = expenses.some((e) => {
    const hour = new Date(e.createdAt).getHours();
    const morningMeal = hour >= 5 && hour < 11 && ['coffee', 'dining'].includes(e.category);
    return BREAKFAST.test(e.description) || morningMeal;
  });
  return {
    first_receipt: expenses.length ? 1 : 0,
    paper_trail: new Set(entries.map((e) => e.date)).size,
    seven_sanity: longestStreak(entries.map((e) => e.date)),
    saver: entries.some((e) => e.type === 'saved') ? 1 : 0,
    walked_away: entries.some((e) => e.type === 'skipped') ? 1 : 0,
    secret: breakfast ? 1 : 0,
  };
}

export type AchievementState = Record<string, { progress: number; unlockedAt: number | null }>;

/**
 * Merges new progress into the saved state. Progress never goes down (deleting an
 * entry doesn't take an achievement away). Returns the ones that just unlocked.
 */
export function updateAchievements(
  state: AchievementState,
  progress: Partial<Record<AchievementId, number>>,
  now: number,
): { state: AchievementState; unlocked: Achievement[] } {
  const next: AchievementState = { ...state };
  const unlocked: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    const p = progress[a.id];
    if (p === undefined) continue;
    const cur = next[a.id] ?? { progress: 0, unlockedAt: null };
    const best = Math.max(cur.progress, p);
    const nowUnlocked = cur.unlockedAt === null && best >= a.goal;
    next[a.id] = { progress: best, unlockedAt: nowUnlocked ? now : cur.unlockedAt };
    if (nowUnlocked) unlocked.push(a);
  }
  return { state: next, unlocked };
}

/** "Under Control": last month had a budget, entries, and stayed within it. */
export function lastMonthUnderControl(
  entries: readonly Entry[],
  lastMonthLimit: number | null,
  now: Date,
): boolean {
  const prev = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const inPrev = entries.filter((e) => e.date.startsWith(prev));
  if (lastMonthLimit === null || !inPrev.length) return false;
  const spent = inPrev.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amountMinor, 0);
  return spent <= lastMonthLimit;
}
