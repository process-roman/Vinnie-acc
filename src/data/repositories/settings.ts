import type { Currency } from '@/domain/money';
import type { Heat } from '@/domain/reaction/dialogue';

import { Db, SqlValue } from '../db';

export type Settings = {
  currency: Currency;
  heat: Heat;
  lastCategory: string;
  notificationsEnabled: boolean;
  /** Hour quiet time starts (0–23). */
  quietStart: number;
  /** Hour quiet time ends (0–23). */
  quietEnd: number;
  createdAt: number;
};

type Row = {
  currency: Currency;
  heat: Heat;
  last_category: string;
  notifications_enabled: number;
  quiet_start: number;
  quiet_end: number;
  created_at: number;
};

/** Reads settings, creating the row with defaults on first launch. */
export async function getSettings(db: Db, now: number): Promise<Settings> {
  await db.run('INSERT OR IGNORE INTO settings (id, created_at) VALUES (1, ?)', [now]);
  const r = (await db.get<Row>('SELECT * FROM settings WHERE id = 1'))!;
  return {
    currency: r.currency,
    heat: r.heat,
    lastCategory: r.last_category,
    notificationsEnabled: r.notifications_enabled === 1,
    quietStart: r.quiet_start,
    quietEnd: r.quiet_end,
    createdAt: r.created_at,
  };
}

type Editable = Omit<Settings, 'createdAt'>;

const COLUMNS: Record<keyof Editable, string> = {
  currency: 'currency',
  heat: 'heat',
  lastCategory: 'last_category',
  notificationsEnabled: 'notifications_enabled',
  quietStart: 'quiet_start',
  quietEnd: 'quiet_end',
};

const toSql = (v: Editable[keyof Editable]): SqlValue => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

export async function updateSettings(db: Db, patch: Partial<Editable>): Promise<void> {
  const keys = Object.keys(patch) as (keyof Editable)[];
  if (!keys.length) return;
  await db.run(
    `UPDATE settings SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = 1`,
    keys.map((k) => toSql(patch[k]!)),
  );
}

/** Playtests only: pretend the app was installed at `at` (ends the honeymoon early). */
export async function setInstalledAt(db: Db, at: number): Promise<void> {
  await db.run('UPDATE settings SET created_at = ? WHERE id = 1', [at]);
}
