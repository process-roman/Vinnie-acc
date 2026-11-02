// Coins, achievements and the office inventory. Game state, kept apart from
// financial data (blueprint B4). The wallet is always SUM(coin_tx.delta).

import type { AchievementState } from '@/domain/achievements';
import type { CoinGrant } from '@/domain/coins';
import type { Owned } from '@/domain/shop';

import { Db } from '../db';

export async function listCoinTx(db: Db): Promise<CoinGrant[]> {
  const rows = await db.all<{ idempotency_key: string; delta: number; reason: string }>(
    'SELECT idempotency_key, delta, reason FROM coin_tx ORDER BY id',
  );
  return rows.map((r) => ({ key: r.idempotency_key, delta: r.delta, reason: r.reason }));
}

/** Grants coins; a key that was already used is ignored, so grants can't double up. */
export async function grantCoins(db: Db, g: CoinGrant, now: number): Promise<void> {
  await db.run(
    'INSERT OR IGNORE INTO coin_tx (idempotency_key, delta, reason, created_at) VALUES (?, ?, ?, ?)',
    [g.key, g.delta, g.reason, now],
  );
}

export async function walletBalance(db: Db): Promise<number> {
  const row = await db.get<{ total: number | null }>('SELECT SUM(delta) AS total FROM coin_tx');
  return row?.total ?? 0;
}

/**
 * Spends coins atomically: fails (and changes nothing) if the balance is too low or
 * the key was used. Returns whether it went through.
 */
export async function spendCoins(db: Db, g: CoinGrant, now: number): Promise<boolean> {
  let ok = false;
  await db.transaction(async () => {
    if ((await walletBalance(db)) + g.delta < 0) return;
    const used = await db.get('SELECT 1 FROM coin_tx WHERE idempotency_key = ?', [g.key]);
    if (used) return;
    await grantCoins(db, g, now);
    ok = true;
  });
  return ok;
}

export async function listAchievements(db: Db): Promise<AchievementState> {
  const rows = await db.all<{ id: string; progress: number; unlocked_at: number | null }>(
    'SELECT * FROM achievements',
  );
  return Object.fromEntries(
    rows.map((r) => [r.id, { progress: r.progress, unlockedAt: r.unlocked_at }]),
  );
}

export async function saveAchievements(db: Db, state: AchievementState): Promise<void> {
  for (const [id, a] of Object.entries(state)) {
    await db.run(
      'INSERT INTO achievements (id, progress, unlocked_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET progress = excluded.progress, unlocked_at = excluded.unlocked_at',
      [id, a.progress, a.unlockedAt],
    );
  }
}

export async function listInventory(db: Db): Promise<Owned[]> {
  const rows = await db.all<{ item_id: string; equipped: number }>(
    'SELECT item_id, equipped FROM inventory ORDER BY bought_at',
  );
  return rows.map((r) => ({ itemId: r.item_id, equipped: r.equipped === 1 }));
}

export async function saveInventory(db: Db, owned: readonly Owned[], now: number): Promise<void> {
  for (const o of owned) {
    await db.run(
      'INSERT INTO inventory (item_id, equipped, bought_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT (item_id) DO UPDATE SET equipped = excluded.equipped',
      [o.itemId, o.equipped ? 1 : 0, now],
    );
  }
}

export async function clearProgression(db: Db): Promise<void> {
  await db.exec('DELETE FROM coin_tx; DELETE FROM achievements; DELETE FROM inventory;');
}
