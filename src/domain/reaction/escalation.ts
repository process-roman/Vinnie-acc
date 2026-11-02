// When a meltdown actually breaks the glass or rings the phone (blueprint §7.3).

import type { Heat } from './dialogue';
import type { Tier } from './tier';

const HOUR = 3600 * 1000;
export const CRACK_COOLDOWN_MS = 48 * HOUR;
export const CALL_COOLDOWN_MS = 72 * HOUR;
/** New users get three days before Vinnie escalates (onboarding has its own scripted one). */
export const HONEYMOON_MS = 72 * HOUR;

export type EscalationInput = {
  tier: Tier;
  heat: Heat;
  now: number;
  installedAt: number;
  lastCrackAt: number | null;
  lastCallAt: number | null;
};

export type Escalation = {
  /** Classic and Unhinged punch the glass; Gentle knocks on it. */
  glass: 'none' | 'punch' | 'knock';
  call: boolean;
  /** A meltdown that couldn't escalate: play the strongest animation allowed instead. */
  held: boolean;
};

export function decideEscalation(i: EscalationInput): Escalation {
  const none: Escalation = { glass: 'none', call: false, held: false };
  if (i.tier !== 'meltdown') return none;
  if (i.now - i.installedAt < HONEYMOON_MS) return { ...none, held: true };
  const glassOk = i.lastCrackAt === null || i.now - i.lastCrackAt >= CRACK_COOLDOWN_MS;
  const callOk = i.lastCallAt === null || i.now - i.lastCallAt >= CALL_COOLDOWN_MS;
  const glass = !glassOk ? 'none' : i.heat === 'gentle' ? 'knock' : 'punch';
  return { glass, call: callOk, held: glass === 'none' && !callOk };
}
