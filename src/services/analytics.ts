// Product analytics (blueprint 8.4). Events go through sanitizeEvent first, so no
// amount, description or merchant can ever leave the device. Sends to PostHog only
// when EXPO_PUBLIC_POSTHOG_KEY is set at build time; otherwise logs in development.

import { AnalyticsEvent, sanitizeEvent } from '@/domain/analytics';

let distinctId: string | null = null;

/** Random per install; never tied to an account. */
export function initAnalytics(id: string): void {
  distinctId = id;
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const clean = sanitizeEvent(event, props);
  if (!clean || !distinctId) return;
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) {
    if (__DEV__) console.debug('[analytics]', clean.event, clean.props);
    return;
  }
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      event: clean.event,
      distinct_id: distinctId,
      properties: clean.props,
    }),
  }).catch(() => {
    // Analytics must never break the app.
  });
}
