// In-character notifications (blueprint §9, 7.1): always opt-in, at most one a
// day, never in quiet hours, and fewer of them if you keep ignoring them.

import { daysLeft, Entry, monthSpentMinor, toDateKey } from './entries';

export type NotificationKind = 'sitdown' | 'proactive_call' | 'late_month' | 'quiet_nudge';

export type NotificationPrefs = {
  enabled: boolean;
  /** Hour (0–23) quiet time starts, e.g. 22. */
  quietStart: number;
  /** Hour (0–23) quiet time ends, e.g. 9. */
  quietEnd: number;
};

export const DEFAULT_PREFS: NotificationPrefs = { enabled: false, quietStart: 22, quietEnd: 9 };

/** What was scheduled before, and whether it was opened. */
export type NotificationLogItem = { kind: NotificationKind; at: number; opened: boolean };

export type PlannedNotification = { kind: NotificationKind; at: number };

export type PlanInput = {
  prefs: NotificationPrefs;
  entries: readonly Entry[];
  limitMinor: number | null;
  now: Date;
  log: readonly NotificationLogItem[];
  /** Last time he actually called (reactive or proactive). */
  lastCallAt: number | null;
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
export const HORIZON_DAYS = 7;
const PROACTIVE_EVERY_MS = 7 * DAY;
const CALL_GAP_MS = 72 * HOUR;
/** After this many unopened in a row, only every other day. */
export const BACKOFF_AFTER = 3;

/** True if `hour` falls in quiet time (which can wrap past midnight). */
export function inQuietHours(hour: number, p: NotificationPrefs): boolean {
  return p.quietStart <= p.quietEnd
    ? hour >= p.quietStart && hour < p.quietEnd
    : hour >= p.quietStart || hour < p.quietEnd;
}

function at(day: Date, hour: number, minute = 0): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).getTime();
}

/** Moves a time out of quiet hours to when they end. */
function outOfQuiet(ms: number, p: NotificationPrefs): number {
  const d = new Date(ms);
  if (!inQuietHours(d.getHours(), p)) return ms;
  const end = at(d, p.quietEnd);
  return end > ms ? end : end + DAY;
}

export function backedOff(log: readonly NotificationLogItem[], now: number): boolean {
  const fired = log.filter((l) => l.at <= now).sort((a, b) => b.at - a.at);
  return fired.length >= BACKOFF_AFTER && fired.slice(0, BACKOFF_AFTER).every((l) => !l.opened);
}

/** The notifications to schedule for the next week, at most one per day. */
export function planNotifications(i: PlanInput): PlannedNotification[] {
  if (!i.prefs.enabled) return [];
  const now = i.now.getTime();
  const today = new Date(i.now.getFullYear(), i.now.getMonth(), i.now.getDate());
  const lastEntry = i.entries.reduce((m, e) => Math.max(m, e.createdAt), 0);
  const spent = monthSpentMinor(i.entries, i.now);
  const lateMonth = i.limitMinor !== null && spent >= i.limitMinor * 0.85 && daysLeft(i.now) >= 7;
  const lastProactive = i.log
    .filter((l) => l.kind === 'proactive_call')
    .reduce((m, l) => Math.max(m, l.at), 0);
  const slow = backedOff(i.log, now);

  const out: PlannedNotification[] = [];
  let proactiveDone = now - lastProactive < PROACTIVE_EVERY_MS;
  let lateDone = !lateMonth;
  let nudgeDone = lastEntry === 0;
  for (let d = 0; d < HORIZON_DAYS; d++) {
    if (slow && d % 2 === 1) continue;
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    const candidates: PlannedNotification[] = [];
    if (day.getDay() === 0) candidates.push({ kind: 'sitdown', at: at(day, 18) });
    if (!proactiveDone && day.getDay() === 4) {
      const t = at(day, 18, 30);
      if (i.lastCallAt === null || t - i.lastCallAt >= CALL_GAP_MS) {
        candidates.push({ kind: 'proactive_call', at: t });
      }
    }
    if (!lateDone && d >= 1) candidates.push({ kind: 'late_month', at: at(day, 12) });
    // Two days without a receipt, if nothing gets logged in between.
    if (!nudgeDone && at(day, 19) - lastEntry >= 2 * DAY) {
      candidates.push({ kind: 'quiet_nudge', at: at(day, 19) });
    }
    const pick = candidates
      .map((c) => ({ ...c, at: outOfQuiet(c.at, i.prefs) }))
      .find((c) => c.at > now + 60_000 && toDateKey(new Date(c.at)) === toDateKey(day));
    if (!pick) continue;
    out.push(pick);
    if (pick.kind === 'proactive_call') proactiveDone = true;
    if (pick.kind === 'late_month') lateDone = true;
    if (pick.kind === 'quiet_nudge') nudgeDone = true;
  }
  return out;
}
