// Vinnie's mood (blueprint §2 and §8): 0–100, starts at 50, drifts back toward 50.
// Mood is presentation; the budget is the truth.

import type { Tier } from './reaction/tier';

export type MoodState = 'proud' | 'relaxed' | 'suspicious' | 'angry' | 'meltdown';

export const MOOD_START = 50;
/** Points per whole day the mood moves back toward 50. */
export const MOOD_DRIFT_PER_DAY = 2;
const DAY = 24 * 3600 * 1000;

export function clampMood(m: number): number {
  return Math.max(0, Math.min(100, Math.round(m)));
}

export function moodState(m: number): MoodState {
  if (m >= 80) return 'proud';
  if (m >= 55) return 'relaxed';
  if (m >= 35) return 'suspicious';
  if (m >= 15) return 'angry';
  return 'meltdown';
}

export const MOOD_LABEL: Record<MoodState, string> = {
  proud: 'Proud',
  relaxed: 'Relaxed',
  suspicious: 'Suspicious',
  angry: 'Angry',
  meltdown: 'Meltdown',
};

/** How a reaction moves his mood. */
export const TIER_MOOD: Record<Tier, number> = {
  approve: 5,
  neutral: 0,
  judge: -4,
  angry: -8,
  meltdown: -12,
};
/** Saving or walking away cheers him up more than a grocery run. */
export const SAVED_MOOD = 8;
export const SKIPPED_MOOD = 6;

/** Replies on a call (blueprint §4.3): honesty goes over better than excuses. */
export const REPLY_MOOD: Record<string, number> = {
  admit: 4,
  promise_never_again: 2,
  excuse_needed: -2,
  excuse_investment: -4,
};
export const DECLINE_MOOD = -3;
/** Hanging up on him twice in one call hurts half as much again. */
export function declineMood(nth: number): number {
  return nth <= 1 ? DECLINE_MOOD : Math.floor(DECLINE_MOOD * 1.5);
}
/** Nobody bothers Luc. */
export const CAT_TEASE_MOOD = -6;

/**
 * Applies whole days of drift since `since`. Returns the new mood and the time the
 * drift was applied up to, so partial days carry over.
 */
export function driftMood(mood: number, since: number, now: number): { mood: number; at: number } {
  const days = Math.floor((now - since) / DAY);
  if (days <= 0) return { mood, at: since };
  const step = Math.min(days * MOOD_DRIFT_PER_DAY, Math.abs(mood - MOOD_START));
  return { mood: mood + Math.sign(MOOD_START - mood) * step, at: since + days * DAY };
}
