import type { Currency } from '@/domain/money';
import type { Heat } from '@/domain/reaction/dialogue';

import { Db } from '../db';

export type Settings = {
  currency: Currency;
  heat: Heat;
  lastCategory: string;
  createdAt: number;
};

type Row = { currency: Currency; heat: Heat; last_category: string; created_at: number };

/** Reads settings, creating the row with defaults on first launch. */
export async function getSettings(db: Db, now: number): Promise<Settings> {
  await db.run('INSERT OR IGNORE INTO settings (id, created_at) VALUES (1, ?)', [now]);
  const r = (await db.get<Row>('SELECT * FROM settings WHERE id = 1'))!;
  return {
    currency: r.currency,
    heat: r.heat,
    lastCategory: r.last_category,
    createdAt: r.created_at,
  };
}

const COLUMNS: Record<keyof Omit<Settings, 'createdAt'>, string> = {
  currency: 'currency',
  heat: 'heat',
  lastCategory: 'last_category',
};

export async function updateSettings(
  db: Db,
  patch: Partial<Omit<Settings, 'createdAt'>>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof COLUMNS)[];
  if (!keys.length) return;
  await db.run(
    `UPDATE settings SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = 1`,
    keys.map((k) => patch[k] as string),
  );
}

/** Playtests only: pretend the app was installed at `at` (ends the honeymoon early). */
export async function setInstalledAt(db: Db, at: number): Promise<void> {
  await db.run('UPDATE settings SET created_at = ? WHERE id = 1', [at]);
}
