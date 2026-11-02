// The promise ledger (blueprint §7.4): Vinnie remembers what you told him.

import type { Entry } from '../entries';
import type { Reason } from './tier';

export type LedgerTag = 'excuse_needed' | 'promise_never_again' | 'excuse_investment' | 'admit';

export type LedgerEntry = {
  id: string;
  tag: string;
  category: string;
  amountMinor: number;
  entryId: string | null;
  createdAt: number;
  resolved: 'kept' | 'broken' | null;
  resolvedAt: number | null;
};

export type LedgerEvent = { id: string; resolved: 'kept' | 'broken' };

const DAY = 24 * 3600 * 1000;
export const PROMISE_WINDOW_MS = 7 * DAY;
export const INVESTMENT_WINDOW_MS = 30 * DAY;

export type LedgerCheck = {
  reasons: Reason[];
  events: LedgerEvent[];
  /** The promise being broken, for "Tuesday you told me…" lines. */
  brokenPromise: LedgerEntry | null;
};

/**
 * Checks a new expense against the ledger: buying in a category you promised to
 * quit within a week breaks the promise.
 */
export function checkLedger(
  ledger: readonly LedgerEntry[],
  entry: Pick<Entry, 'type' | 'category'>,
  now: number,
): LedgerCheck {
  const out: LedgerCheck = { reasons: [], events: [], brokenPromise: null };
  if (entry.type !== 'expense') return out;
  const broken = ledger
    .filter(
      (l) =>
        l.tag === 'promise_never_again' &&
        l.resolved === null &&
        l.category === entry.category &&
        now - l.createdAt < PROMISE_WINDOW_MS,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  if (broken.length) {
    out.reasons.push('brokenPromise');
    out.brokenPromise = broken[0];
    out.events.push(...broken.map((l) => ({ id: l.id, resolved: 'broken' as const })));
  }
  const investedRecently = ledger.some(
    (l) => l.tag === 'excuse_investment' && now - l.createdAt < INVESTMENT_WINDOW_MS,
  );
  if (investedRecently) out.reasons.push('investmentAgain');
  return out;
}

/**
 * Promises kept for a full week: no expense in that category since the promise.
 * Each earns a pride callback once.
 */
export function keptPromises(
  ledger: readonly LedgerEntry[],
  entries: readonly Pick<Entry, 'type' | 'category' | 'createdAt'>[],
  now: number,
): LedgerEntry[] {
  return ledger.filter(
    (l) =>
      l.tag === 'promise_never_again' &&
      l.resolved === null &&
      now - l.createdAt >= PROMISE_WINDOW_MS &&
      !entries.some(
        (e) => e.type === 'expense' && e.category === l.category && e.createdAt > l.createdAt,
      ),
  );
}

/** Weekday name for "Tuesday you told me…". Within the last week, so the day is enough. */
export function weekday(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'long' });
}
