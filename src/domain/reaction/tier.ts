// Reaction tiers (blueprint §7.2), M1 version: tier and the reasons behind it.
// Mood, cooldowns, the honeymoon period and the promise ledger come in M4.

import type { CategoryKind } from '../categories';
import type { CategoryStats, EntryType } from '../entries';

export type Tier = 'approve' | 'neutral' | 'judge' | 'angry' | 'meltdown';

export const TIER_ORDER: readonly Tier[] = ['approve', 'neutral', 'judge', 'angry', 'meltdown'];

/** Why a tier was picked. Dialogue lines can require these as conditions. */
export type Reason =
  | 'saved'
  | 'skipped'
  | 'essential'
  | 'pushedOverBudget'
  | 'alreadyOverBudget'
  | 'crossed85'
  | 'nearLimit'
  | 'repeat'
  | 'repeatAgain'
  | 'big'
  | 'lateMonth'
  | 'noBudget';

export type TierInput = {
  type: EntryType;
  amountMinor: number;
  kind: CategoryKind;
  /** Monthly limit, or null when no budget is set. */
  limitMinor: number | null;
  /** Spent this month before this entry. */
  spentBeforeMinor: number;
  daysLeft: number;
  stats: CategoryStats;
};

export type TierResult = { tier: Tier; reasons: Reason[] };

const max = (a: Tier, b: Tier): Tier => (TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b);

export function evaluateTier(input: TierInput): TierResult {
  const { type, amountMinor: amt, kind, limitMinor: limit, spentBeforeMinor: before } = input;

  if (type === 'saved') return { tier: 'approve', reasons: ['saved'] };
  if (type === 'skipped') return { tier: 'approve', reasons: ['skipped'] };

  const reasons: Reason[] = [];
  const after = before + amt;
  const avg = input.stats.avgMinor;

  // Essentials are never judged. Only a spend far above the user's own average gets a comment.
  if (kind === 'essential') {
    reasons.push('essential');
    if (avg !== null && amt > avg * 3) {
      reasons.push('big');
      return { tier: 'neutral', reasons };
    }
    return { tier: 'approve', reasons };
  }

  let tier: Tier = 'neutral';
  const big =
    (limit !== null && amt >= limit * 0.1) ||
    (avg !== null && input.stats.countThisMonth >= 2 && amt > avg * 2);
  if (big) {
    reasons.push('big');
    tier = max(tier, 'judge');
  }
  if (limit === null) {
    reasons.push('noBudget');
  } else {
    if (before > limit) {
      reasons.push('alreadyOverBudget');
      tier = max(tier, big ? 'meltdown' : 'angry');
    } else if (after > limit) {
      reasons.push('pushedOverBudget');
      tier = max(tier, 'meltdown');
    } else if (before < limit * 0.85 && after >= limit * 0.85) {
      reasons.push('crossed85');
      tier = max(tier, 'angry');
    } else if (before >= limit * 0.85) {
      reasons.push('nearLimit');
      tier = max(tier, 'judge');
    }
    if (input.daysLeft <= 7 && after >= limit * 0.7) {
      reasons.push('lateMonth');
      tier = max(tier, 'judge');
    }
  }
  const repeats = input.stats.countLast48h;
  if (repeats >= 2) {
    reasons.push('repeatAgain');
    tier = max(tier, 'angry');
  } else if (repeats === 1) {
    reasons.push('repeat');
    tier = max(tier, 'judge');
  }

  // Mixed categories ("Other") can be questioned but never trigger an escalation.
  if (kind === 'mixed' && TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf('judge')) {
    tier = 'judge';
  }
  return { tier, reasons };
}
