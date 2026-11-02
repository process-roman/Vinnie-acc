// Share cards (blueprint §12, 7.3): Vinnie's best moments, without exposing your
// finances. Amounts and descriptions only appear if you switch them on.

import { Currency, formatMoney } from './money';

export type ShareMoment =
  | {
      kind: 'crack' | 'call';
      line: string;
      amountMinor: number;
      description: string;
      category: string;
    }
  | { kind: 'achievement'; name: string; description: string };

export type ShareOptions = { showAmount: boolean; showDescription: boolean };

export type ShareCardContent = {
  headline: string;
  quote: string;
  /** Only present when the user chose to show it. */
  detail: string | null;
};

const HEADLINE = {
  crack: 'My accountant punched my screen',
  call: 'My accountant called me',
  achievement: 'Achievement unlocked',
};

export function shareCardContent(
  m: ShareMoment,
  opts: ShareOptions,
  currency: Currency = 'USD',
): ShareCardContent {
  if (m.kind === 'achievement') {
    return { headline: HEADLINE.achievement, quote: `${m.name}: ${m.description}`, detail: null };
  }
  const parts: string[] = [];
  if (opts.showDescription && m.description.trim()) parts.push(m.description.trim());
  if (opts.showAmount) parts.push(formatMoney(m.amountMinor, currency));
  return {
    headline: HEADLINE[m.kind],
    // His line can quote the amount or what you bought; hide those unless switched on.
    quote: opts.showAmount ? m.line : redactAmounts(m.line),
    detail: parts.length ? parts.join(' · ') : null,
  };
}

/** Replaces money amounts in a line with "$$$" so the card never leaks numbers. */
export function redactAmounts(text: string): string {
  return text.replace(/[$€£]\s?\d[\d,]*(\.\d+)?/g, '$$$$$$');
}
