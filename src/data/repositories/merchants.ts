// Merchant -> category, learned from the user's own entries (blueprint 2.5).

import { normalizeMerchant } from '@/domain/merchant';

import { Db } from '../db';

export async function learnMerchant(
  db: Db,
  merchant: string,
  category: string,
  now: number,
): Promise<void> {
  const key = normalizeMerchant(merchant);
  if (!key) return;
  await db.run(
    'INSERT INTO merchant_categories (merchant, category, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT (merchant) DO UPDATE SET category = excluded.category, updated_at = excluded.updated_at',
    [key, category, now],
  );
}

export async function categoryForMerchant(db: Db, merchant: string): Promise<string | null> {
  const key = normalizeMerchant(merchant);
  if (!key) return null;
  const row = await db.get<{ category: string }>(
    'SELECT category FROM merchant_categories WHERE merchant = ?',
    [key],
  );
  return row?.category ?? null;
}

export async function clearMerchants(db: Db): Promise<void> {
  await db.run('DELETE FROM merchant_categories');
}
