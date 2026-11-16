// In-character notifications (blueprint §9, 7.1): always opt-in, at most one a day and two
// a week, never in quiet hours, and fewer of them if you keep ignoring them.

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
/** No more than this many in any seven days. */
export const MAX_PER_WEEK = 2;
const WEEK = 7 * DAY;
/** When there's only room for some, these win, in this order. */
const PRIORITY: readonly NotificationKind[] = [
  'sitdown',
  'late_month',
  'proactive_call',
  'quiet_nudge',
];
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

/** The most of these times that fall within any seven days. */
export function mostInAnyWeek(times: readonly number[]): number {
  const t = [...times].sort((a, b) => a - b);
  let most = 0;
  for (let k = 0, j = 0; k < t.length; k++) {
    while (t[k] - t[j] >= WEEK) j++;
    most = Math.max(most, k - j + 1);
  }
  return most;
}

export function backedOff(log: readonly NotificationLogItem[], now: number): boolean {
  const fired = log.filter((l) => l.at <= now).sort((a, b) => b.at - a.at);
  return fired.length >= BACKOFF_AFTER && fired.slice(0, BACKOFF_AFTER).every((l) => !l.opened);
}

/** The notifications to schedule for the next week: at most one a day and two a week. */
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

  // Everything that could go out this week.
  const candidates: PlannedNotification[] = [];
  for (let d = 0; d < HORIZON_DAYS; d++) {
    if (slow && d % 2 === 1) continue;
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    const options: PlannedNotification[] = [];
    if (day.getDay() === 0) options.push({ kind: 'sitdown', at: at(day, 18) });
    if (now - lastProactive >= PROACTIVE_EVERY_MS && day.getDay() === 4) {
      const t = at(day, 18, 30);
      if (i.lastCallAt === null || t - i.lastCallAt >= CALL_GAP_MS) {
        options.push({ kind: 'proactive_call', at: t });
      }
    }
    if (lateMonth && d >= 1) options.push({ kind: 'late_month', at: at(day, 12) });
    // Two days without a receipt, if nothing gets logged in between.
    if (lastEntry !== 0 && at(day, 19) - lastEntry >= 2 * DAY) {
      options.push({ kind: 'quiet_nudge', at: at(day, 19) });
    }
    for (const c of options) {
      const moved = { ...c, at: outOfQuiet(c.at, i.prefs) };
      if (moved.at > now + 60_000 && toDateKey(new Date(moved.at)) === toDateKey(day)) {
        candidates.push(moved);
      }
    }
  }

  // Keep the most useful ones, earliest first within a kind: one of each kind, one a day,
  // and never more than two in any seven days, counting the ones already sent.
  const sent = i.log.filter((l) => l.at <= now).map((l) => l.at);
  const rank = (k: NotificationKind) => PRIORITY.indexOf(k);
  const out: PlannedNotification[] = [];
  for (const c of [...candidates].sort((a, b) => rank(a.kind) - rank(b.kind) || a.at - b.at)) {
    if (out.some((o) => o.kind === c.kind)) continue;
    const day = toDateKey(new Date(c.at));
    if (out.some((o) => toDateKey(new Date(o.at)) === day)) continue;
    if (mostInAnyWeek([...sent, ...out.map((o) => o.at), c.at]) > MAX_PER_WEEK) continue;
    out.push(c);
  }
  return out.sort((a, b) => a.at - b.at);
}
