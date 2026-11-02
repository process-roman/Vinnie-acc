// Turns a new entry into Vinnie's reaction: tier, spoken line, and whether he
// punches the glass and calls. Pure: everything it needs is passed in.

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
import { evaluateTier, Reason, Tier } from './tier';

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
};

export type Reaction = {
  tier: Tier;
  reasons: Reason[];
  lineId: string;
  line: string;
  /** Classic and above: he punches the glass. Gentle: he knocks instead. */
  escalation: 'none' | 'punch' | 'knock';
  call: FilledCall | null;
};

export type ReactContext = {
  /** Existing entries, not including the new one. */
  entries: readonly Entry[];
  limitMinor: number | null;
  heat: Heat;
  currency: Currency;
  recentLineIds: readonly string[];
  now: Date;
  rand: () => number;
};

export function planReaction(entry: NewEntry, ctx: ReactContext): Reaction {
  const { entries, limitMinor, now } = ctx;
  const spentBefore = monthSpentMinor(entries, now);
  const stats = categoryStats(entries, entry.category, now);
  const left = daysLeftIn(now);
  const category = getCategory(entry.category);

  const { tier, reasons } = evaluateTier({
    type: entry.type,
    amountMinor: entry.amountMinor,
    kind: category.kind,
    limitMinor,
    spentBeforeMinor: spentBefore,
    daysLeft: left,
    stats,
  });

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
  };

  const line = selectLine(
    LINES,
    { tier, heat: ctx.heat, category: entry.category, reasons, recent: ctx.recentLineIds },
    ctx.rand,
  );
  if (!line) throw new Error(`No line for tier ${tier} at heat ${ctx.heat}`);

  let call: FilledCall | null = null;
  if (tier === 'meltdown') {
    const script = selectCallScript(SCRIPTS, reasons, ctx.heat);
    if (script) {
      const fill = (t: string) => fillPlaceholders(t, values);
      call = {
        scriptId: script.id,
        lines: script.lines.map(fill),
        replies: script.replies.map((r) => ({ ...r, response: fill(r.response) })),
        closer: fill(script.closer),
        declineRetry: calls.declineRetry,
      };
    }
  }

  return {
    tier,
    reasons,
    lineId: line.id,
    line: fillPlaceholders(line.text, values),
    escalation: tier !== 'meltdown' ? 'none' : ctx.heat === 'gentle' ? 'knock' : 'punch',
    call,
  };
}
