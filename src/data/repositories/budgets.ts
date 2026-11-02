import { Db } from '../db';

/**
 * The limit for a month (YYYY-MM). A month with no row of its own carries over the
 * most recent earlier month's limit; null if no budget was ever set.
 */
export async function getLimit(db: Db, month: string): Promise<number | null> {
  const row = await db.get<{ limit_minor: number }>(
    'SELECT limit_minor FROM budgets WHERE month <= ? ORDER BY month DESC LIMIT 1',
    [month],
  );
  return row?.limit_minor ?? null;
}

export async function setLimit(db: Db, month: string, limitMinor: number): Promise<void> {
  await db.run(
    'INSERT INTO budgets (month, limit_minor) VALUES (?, ?) ' +
      'ON CONFLICT (month) DO UPDATE SET limit_minor = excluded.limit_minor',
    [month, limitMinor],
  );
}

export async function clearBudgets(db: Db): Promise<void> {
  await db.run('DELETE FROM budgets');
}
