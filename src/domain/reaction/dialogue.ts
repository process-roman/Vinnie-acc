// Picks what Vinnie says (blueprint §7.5): line selection by tier, heat, category
// and conditions, a no-repeat window, and placeholders filled from real data.

import type { Reason, Tier } from './tier';

export type Heat = 'gentle' | 'classic' | 'unhinged';
const HEAT_ORDER: readonly Heat[] = ['gentle', 'classic', 'unhinged'];

export function heatAllows(userHeat: Heat, minHeat: Heat): boolean {
  return HEAT_ORDER.indexOf(minHeat) <= HEAT_ORDER.indexOf(userHeat);
}

export type Line = {
  id: string;
  text: string;
  tier: Tier;
  minHeat: Heat;
  categories?: string[];
  conditions?: Reason[];
  weight?: number;
};

export type LineQuery = {
  tier: Tier;
  heat: Heat;
  category: string;
  reasons: readonly Reason[];
  /** Recently shown line ids, most recent last. */
  recent: readonly string[];
};

export const NO_REPEAT_WINDOW = 20;

function matches(line: Line, q: LineQuery): boolean {
  if (line.tier !== q.tier || !heatAllows(q.heat, line.minHeat)) return false;
  if (line.categories?.length && !line.categories.includes(q.category)) return false;
  return (line.conditions ?? []).every((c) => q.reasons.includes(c));
}

/** More specific lines win: category and condition matches, then the user's exact heat. */
function specificity(line: Line, q: LineQuery): number {
  return (
    (line.categories?.length ? 2 : 0) +
    (line.conditions?.length ?? 0) * 2 +
    (line.minHeat === q.heat ? 1 : 0)
  );
}

function weightedPick<T extends { weight?: number }>(items: readonly T[], rand: () => number): T {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * The best line for the query, or null if none matches. Recently shown lines are
 * skipped unless nothing else fits.
 */
export function selectLine(lines: readonly Line[], q: LineQuery, rand: () => number): Line | null {
  const candidates = lines.filter((l) => matches(l, q));
  if (!candidates.length) return null;
  const recent = new Set(q.recent.slice(-NO_REPEAT_WINDOW));
  const fresh = candidates.filter((l) => !recent.has(l.id));
  const pool = fresh.length ? fresh : candidates;
  const best = Math.max(...pool.map((l) => specificity(l, q)));
  return weightedPick(
    pool.filter((l) => specificity(l, q) === best),
    rand,
  );
}

export type Placeholders = Record<string, string | number>;

/** Fills {name} placeholders. Throws on a missing value so no "{...}" ever reaches the screen. */
export function fillPlaceholders(text: string, values: Placeholders): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`Missing placeholder '${key}' in "${text}"`);
    return String(values[key]);
  });
}

export type Reply = { text: string; tag: string; response: string };

export type CallScript = {
  id: string;
  /** A reason that triggers this script, or "any". */
  trigger: Reason | 'any';
  minHeat: Heat;
  lines: string[];
  replies: Reply[];
  closer: string;
};

/** The call script for a meltdown: the first whose trigger matches, else a generic one. */
export function selectCallScript(
  scripts: readonly CallScript[],
  reasons: readonly Reason[],
  heat: Heat,
): CallScript | null {
  const allowed = scripts.filter((s) => heatAllows(heat, s.minHeat));
  return (
    allowed.find((s) => s.trigger !== 'any' && reasons.includes(s.trigger)) ??
    allowed.find((s) => s.trigger === 'any') ??
    null
  );
}
