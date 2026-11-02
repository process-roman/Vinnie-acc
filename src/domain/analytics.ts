// Analytics events (blueprint 8.4). Every property is checked against a fixed list
// of allowed values, so amounts, descriptions and merchants can never be sent.

export const EVENTS = {
  onboarding_step: {
    step: [
      'meet',
      'heat',
      'budget',
      'receipt',
      'meltdown',
      'repair',
      'shop',
      'notifications',
      'done',
    ],
  },
  entry_logged: {
    type: ['expense', 'saved', 'skipped'],
    via: ['chip', 'sheet', 'deeplink', 'onboarding'],
  },
  reaction_shown: { tier: ['approve', 'neutral', 'judge', 'angry', 'meltdown'] },
  crack_shown: { level: ['1', '2', '3'] },
  call_answered: {},
  call_declined: {},
  reply_chosen: { tag: ['excuse_needed', 'promise_never_again', 'excuse_investment', 'admit'] },
  share_opened: { kind: ['crack', 'call', 'achievement'] },
  sitdown_done: {},
  gift_bought: {},
  item_bought: {},
} as const;

export type AnalyticsEvent = keyof typeof EVENTS;
export type AnalyticsProps = Record<string, string>;

/**
 * Keeps only allowed properties with allowed values. Anything else (an amount, a
 * description, a merchant, a typo) is dropped. Unknown events return null.
 */
export function sanitizeEvent(
  event: string,
  props: Record<string, unknown> = {},
): { event: AnalyticsEvent; props: AnalyticsProps } | null {
  if (!(event in EVENTS)) return null;
  const allowed = EVENTS[event as AnalyticsEvent] as Record<string, readonly string[]>;
  const clean: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    const values = allowed[k];
    const s = String(v);
    if (values && values.includes(s)) clean[k] = s;
  }
  return { event: event as AnalyticsEvent, props: clean };
}
