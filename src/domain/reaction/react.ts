// Turns a new entry into Vinnie's reaction: tier, spoken line, mood change,
// promise-ledger callbacks, and whether he punches the glass and calls.
// Pure: everything it needs is passed in.

import calls from '@/content/calls.json';
import lines from '@/content/lines.json';

import { getCategory } from '../categories';
import {
  categoryStats,
  daysLeft as daysLeftIn,
  Entry,
  EntryType,
  monthSpentMinor,
} from '../entries';
import { Currency, formatMoney } from '../money';
import { SAVED_MOOD, SKIPPED_MOOD, TIER_MOOD } from '../mood';
import {
  CallScript,
  fillPlaceholders,
  Heat,
  Line,
  Placeholders,
  Reply,
  selectCallScript,
  selectLine,
} from './dialogue';
import { decideEscalation } from './escalation';
import { checkLedger, LedgerEntry, LedgerEvent, weekday } from './ledger';
import { evaluateTier, Reason, Tier, TIER_ORDER } from './tier';

const LINES = lines as Line[];
const SCRIPTS = calls.scripts as CallScript[];

export type NewEntry = {
  type: EntryType;
  amountMinor: number;
  category: string;
  description: string;
};

export type FilledCall = {
  scriptId: string;
  lines: string[];
  replies: Reply[];
  closer: string;
  declineRetry: string;
  /** When you hang up on him a second time. */
  declineFinal: string;
};

export type Reaction = {
  /** The tier he reacts with. A meltdown held back by a cooldown plays as angry. */
  tier: Tier;
  reasons: Reason[];
  lineId: string;
  line: string;
  /** Classic and above: he punches the glass. Gentle: he knocks instead. */
  escalation: 'none' | 'punch' | 'knock';
  call: FilledCall | null;
  moodDelta: number;
  ledgerEvents: LedgerEvent[];
};

export type CharacterContext = {
  installedAt: number;
  lastCrackAt: number | null;
  lastCallAt: number | null;
};

export type ReactContext = {
  /** Existing entries, not including the new one. */
  entries: readonly Entry[];
  limitMinor: number | null;
  heat: Heat;
  currency: Currency;
  recentLineIds: readonly string[];
  ledger: readonly LedgerEntry[];
  character: CharacterContext;
  now: Date;
  rand: () => number;
};

const atLeast = (tier: Tier, floor: Tier) => TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(floor);

export function planReaction(entry: NewEntry, ctx: ReactContext): Reaction {
  const { entries, limitMinor, now } = ctx;
  const spentBefore = monthSpentMinor(entries, now);
  const stats = categoryStats(entries, entry.category, now);
  const left = daysLeftIn(now);
  const category = getCategory(entry.category);

  const evaluated = evaluateTier({
    type: entry.type,
    amountMinor: entry.amountMinor,
    kind: category.kind,
    limitMinor,
    spentBeforeMinor: spentBefore,
    daysLeft: left,
    stats,
  });

  // The promise ledger can make things worse: breaking a promise is at least angry,
  // and a meltdown if the purchase was already a problem. Essentials never count.
  let tier = evaluated.tier;
  const reasons = [...evaluated.reasons];
  const ledger = checkLedger(ctx.ledger, entry, now.getTime());
  if (category.kind !== 'essential') {
    if (ledger.reasons.includes('brokenPromise')) {
      tier = atLeast(tier, 'judge') ? 'meltdown' : 'angry';
      reasons.push('brokenPromise');
    }
    if (ledger.reasons.includes('investmentAgain') && atLeast(tier, 'judge')) {
      reasons.push('investmentAgain');
    }
  }

  const esc = decideEscalation({
    tier,
    heat: ctx.heat,
    now: now.getTime(),
    installedAt: ctx.character.installedAt,
    lastCrackAt: ctx.character.lastCrackAt,
    lastCallAt: ctx.character.lastCallAt,
  });
  // Cooling down from both: he still blows up, just without the glass or the phone.
  if (esc.held) tier = 'angry';

  const money = (m: number) => formatMoney(m, ctx.currency, { trimZeroCents: true });
  const spentAfter = spentBefore + (entry.type === 'expense' ? entry.amountMinor : 0);
  const values: Placeholders = {
    amount: money(entry.amountMinor),
    category: category.label.toLowerCase(),
    Category: category.label,
    count: stats.countThisMonth + 1,
    monthTotal: money(stats.monthTotalMinor + entry.amountMinor),
    daysLeft: left,
    remaining: limitMinor === null ? 'no budget' : money(Math.max(0, limitMinor - spentAfter)),
    promiseDay: ledger.brokenPromise ? weekday(ledger.brokenPromise.createdAt) : 'The other day',
    today: weekday(now.getTime()),
  };

  const line = selectLine(
    LINES,
    { tier, heat: ctx.heat, category: entry.category, reasons, recent: ctx.recentLineIds },
    ctx.rand,
  );
  if (!line) throw new Error(`No line for tier ${tier} at heat ${ctx.heat}`);

  let call: FilledCall | null = null;
  if (esc.call) {
    const script = selectCallScript(SCRIPTS, reasons, ctx.heat, ctx.rand);
    if (script) {
      const fill = (t: string) => fillPlaceholders(t, values);
      call = {
        scriptId: script.id,
        lines: script.lines.map(fill),
        replies: script.replies.map((r) => ({ ...r, response: fill(r.response) })),
        closer: fill(script.closer),
        declineRetry: calls.declineRetry,
        declineFinal: calls.declineFinal,
      };
    }
  }

  return {
    tier,
    reasons,
    lineId: line.id,
    line: fillPlaceholders(line.text, values),
    escalation: esc.glass,
    call,
    moodDelta:
      entry.type === 'saved'
        ? SAVED_MOOD
        : entry.type === 'skipped'
          ? SKIPPED_MOOD
          : TIER_MOOD[tier],
    ledgerEvents: category.kind === 'essential' ? [] : ledger.events,
  };
}
