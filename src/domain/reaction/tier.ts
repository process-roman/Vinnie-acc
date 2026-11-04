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
  | 'noBudget'
  /** Good news that's true: spending this month is still within the limit. */
  | 'underBudget'
  /** One purchase over this category's limit. */
  | 'overLimit'
  /** Far over it. */
  | 'wayOverLimit'
  /** So far over it that he comes through the glass. */
  | 'absurdOverLimit'
  /** Small purchases that have added up to a lot in this category this month. */
  | 'heavyMonth'
  /** Bought something in a category you promised to quit (promise ledger). */
  | 'brokenPromise'
  /** Called something an investment again within 30 days. */
  | 'investmentAgain';

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
  /** How much is too much for one purchase in this category. */
  categoryLimitMinor?: number;
  /** The angriest he can get about this category. */
  maxTier?: Tier;
};

export type TierResult = { tier: Tier; reasons: Reason[] };

const max = (a: Tier, b: Tier): Tier => (TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b);

/** How many times over a category's limit starts to make him angry, then lose it. */
export const WAY_OVER_LIMIT = 2.5;
export const ABSURD_OVER_LIMIT = 6;
/** A month's total in a category is too much at this many times its one-purchase limit. */
export const HEAVY_MONTH_LIMITS = 6;

function limitFloor(input: TierInput): { floor: Tier | null; reasons: Reason[] } {
  const limit = input.categoryLimitMinor;
  if (!limit) return { floor: null, reasons: [] };
  const reasons: Reason[] = [];
  let floor: Tier | null = null;
  const times = input.amountMinor / limit;
  if (times > 1) {
    reasons.push('overLimit');
    floor = 'judge';
  }
  if (times > WAY_OVER_LIMIT) {
    reasons.push('wayOverLimit');
    floor = 'angry';
  }
  if (times > ABSURD_OVER_LIMIT) {
    reasons.push('absurdOverLimit');
    floor = 'meltdown';
  }
  // Medical costs add up through no fault of yours: the monthly nag isn't for those.
  const heavy = input.stats.monthTotalMinor + input.amountMinor > limit * HEAVY_MONTH_LIMITS;
  if (heavy && !input.maxTier) {
    reasons.push('heavyMonth');
    floor = floor ?? 'judge';
  }
  return { floor, reasons };
}

const min = (a: Tier, b: Tier): Tier => (TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b);

export function evaluateTier(input: TierInput): TierResult {
  const { type, amountMinor: amt, kind, limitMinor: limit, spentBeforeMinor: before } = input;

  const within = (spent: number): Reason[] =>
    limit !== null && spent <= limit ? ['underBudget'] : [];
  if (type === 'saved') return { tier: 'approve', reasons: ['saved', ...within(before)] };
  if (type === 'skipped') return { tier: 'approve', reasons: ['skipped', ...within(before)] };

  const reasons: Reason[] = [];
  const after = before + amt;
  const over = limitFloor(input);
  const avg = input.stats.avgMinor;

  // Essentials aren't judged for being essentials: going over the budget on them is fine.
  // Only an amount past the category's own limit gets him going.
  if (kind === 'essential') {
    reasons.push('essential');
    if (over.floor) {
      const tier = input.maxTier ? min(over.floor, input.maxTier) : over.floor;
      return { tier, reasons: [...reasons, ...over.reasons] };
    }
    if (avg !== null && amt > avg * 3) {
      reasons.push('big');
      return { tier: 'neutral', reasons };
    }
    return { tier: 'approve', reasons: [...reasons, ...within(after)] };
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
  // A single purchase far past the limit is about the purchase, whatever the category.
  if (over.floor) {
    tier = max(tier, kind === 'mixed' ? min(over.floor, 'angry') : over.floor);
    reasons.push(...over.reasons);
  }
  return { tier: input.maxTier ? min(tier, input.maxTier) : tier, reasons };
}
