import { beforeEach, describe, expect, it } from '@jest/globals';

import { Db } from '../db';
import { migrate } from '../migrations';
import {
  archiveCustomCategory,
  clearCategories,
  insertCustomCategory,
  listCategoryLimits,
  listCustomCategories,
  saveCategoryLimit,
} from '../repositories/categories';
import { getLimit, setLimit } from '../repositories/budgets';
import {
  clearEntries,
  deleteEntry,
  deleteExamples,
  insertEntry,
  listEntries,
  StoredEntry,
  updateEntry,
} from '../repositories/entries';
import { getCharacter, resetCharacter, saveCharacter } from '../repositories/character';
import { insertLedger, listLedger, resolveLedger } from '../repositories/ledger';
import { categoryForMerchant, learnMerchant } from '../repositories/merchants';
import {
  grantCoins,
  listAchievements,
  listCoinTx,
  listInventory,
  saveAchievements,
  saveInventory,
  spendCoins,
  walletBalance,
} from '../repositories/progression';
import { listNotificationLog, markOpened, replaceUpcoming } from '../repositories/notificationLog';
import { getSettings, updateSettings } from '../repositories/settings';
import { createTestDb } from './testDb';

const entry = (over: Partial<StoredEntry> = {}): StoredEntry => ({
  id: Math.random().toString(36).slice(2),
  type: 'expense',
  amountMinor: 650,
  category: 'coffee',
  description: 'latte',
  date: '2026-11-02',
  isExample: false,
  tier: 'neutral',
  createdAt: 1000,
  updatedAt: 1000,
  ...over,
});

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('migrations', () => {
  it('are idempotent', async () => {
    await migrate(db);
    const row = await db.get<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(7);
  });
});

describe('entries', () => {
  it('round-trips an entry', async () => {
    const e = entry({ isExample: true, tier: 'meltdown' });
    await insertEntry(db, e);
    expect(await listEntries(db)).toEqual([e]);
  });

  it('lists oldest first by date then creation time', async () => {
    await insertEntry(db, entry({ id: 'b', date: '2026-11-02', createdAt: 2 }));
    await insertEntry(db, entry({ id: 'a', date: '2026-11-01', createdAt: 9 }));
    await insertEntry(db, entry({ id: 'c', date: '2026-11-02', createdAt: 3 }));
    expect((await listEntries(db)).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('updates fields and the edit time', async () => {
    await insertEntry(db, entry({ id: 'x' }));
    await updateEntry(
      db,
      'x',
      {
        type: 'expense',
        amountMinor: 900,
        category: 'dining',
        description: 'lunch',
        date: '2026-11-01',
      },
      5000,
    );
    const [e] = await listEntries(db);
    expect(e).toMatchObject({
      amountMinor: 900,
      category: 'dining',
      description: 'lunch',
      updatedAt: 5000,
    });
  });

  it('soft-deletes', async () => {
    await insertEntry(db, entry({ id: 'x' }));
    await deleteEntry(db, 'x', 5000);
    expect(await listEntries(db)).toEqual([]);
    const raw = await db.get<{ deleted_at: number }>(
      'SELECT deleted_at FROM entries WHERE id = ?',
      ['x'],
    );
    expect(raw?.deleted_at).toBe(5000);
  });

  it('removes only examples', async () => {
    await insertEntry(db, entry({ id: 'ex', isExample: true }));
    await insertEntry(db, entry({ id: 'real' }));
    await deleteExamples(db, 5000);
    expect((await listEntries(db)).map((e) => e.id)).toEqual(['real']);
  });

  it('rejects zero and negative amounts', async () => {
    await expect(insertEntry(db, entry({ amountMinor: 0 }))).rejects.toThrow();
    await expect(insertEntry(db, entry({ amountMinor: -5 }))).rejects.toThrow();
  });

  it('clears everything', async () => {
    await insertEntry(db, entry());
    await clearEntries(db);
    expect(await listEntries(db)).toEqual([]);
  });
});

describe('budgets', () => {
  it('has no limit until one is set', async () => {
    expect(await getLimit(db, '2026-11')).toBeNull();
  });

  it('carries the last limit forward to later months', async () => {
    await setLimit(db, '2026-09', 150000);
    await setLimit(db, '2026-11', 200000);
    expect(await getLimit(db, '2026-10')).toBe(150000);
    expect(await getLimit(db, '2026-12')).toBe(200000);
    expect(await getLimit(db, '2026-08')).toBeNull();
  });

  it('overwrites a month', async () => {
    await setLimit(db, '2026-11', 100000);
    await setLimit(db, '2026-11', 120000);
    expect(await getLimit(db, '2026-11')).toBe(120000);
  });
});

describe('settings', () => {
  it('creates defaults once and keeps updates', async () => {
    const first = await getSettings(db, 42);
    expect(first).toEqual({
      currency: 'USD',
      heat: 'classic',
      userName: '',
      lastCategory: 'coffee',
      notificationsEnabled: false,
      quietStart: 22,
      quietEnd: 9,
      onboardingDone: false,
      sound: true,
      haptics: true,
      analyticsId: null,
      createdAt: 42,
    });
    await updateSettings(db, {
      heat: 'gentle',
      lastCategory: 'dining',
      notificationsEnabled: true,
    });
    expect(await getSettings(db, 99)).toMatchObject({
      heat: 'gentle',
      lastCategory: 'dining',
      notificationsEnabled: true,
      createdAt: 42,
    });
  });
});

describe('merchants', () => {
  it('learns and recalls a category, ignoring store numbers and case', async () => {
    await learnMerchant(db, 'STARBUCKS #1234', 'coffee', 1);
    expect(await categoryForMerchant(db, 'Starbucks')).toBe('coffee');
    await learnMerchant(db, 'starbucks', 'dining', 2);
    expect(await categoryForMerchant(db, 'Starbucks #99')).toBe('dining');
    expect(await categoryForMerchant(db, 'Unknown Deli')).toBeNull();
  });
});

describe('transactions', () => {
  it('roll back on error', async () => {
    await expect(
      db.transaction(async () => {
        await insertEntry(db, entry({ id: 'x' }));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await listEntries(db)).toEqual([]);
  });
});

describe('character state', () => {
  it('starts calm and uncracked, and saves changes', async () => {
    const first = await getCharacter(db, 100);
    expect(first).toEqual({
      mood: 50,
      moodAt: 100,
      crackLevel: 0,
      crackSeed: 1,
      impact: null,
      lastCrackAt: null,
      lastCallAt: null,
      lastRepairDay: null,
    });
    const next = {
      ...first,
      mood: 22,
      crackLevel: 2 as const,
      crackSeed: 777,
      impact: { x: 0.5, y: 0.25 },
      lastCrackAt: 5000,
      lastCallAt: 6000,
      lastRepairDay: '2026-11-02',
    };
    await saveCharacter(db, next);
    expect(await getCharacter(db, 999)).toEqual(next);
    await resetCharacter(db, 1234);
    expect((await getCharacter(db, 0)).crackLevel).toBe(0);
  });

  it('rejects an impossible crack level', async () => {
    const c = await getCharacter(db, 1);
    await expect(saveCharacter(db, { ...c, crackLevel: 7 as 3 })).rejects.toThrow();
  });
});

describe('promise ledger', () => {
  it('records replies and resolves promises once', async () => {
    const p = {
      id: 'p1',
      tag: 'promise_never_again',
      category: 'shopping',
      amountMinor: 9000,
      entryId: 'e1',
      createdAt: 10,
      resolved: null,
      resolvedAt: null,
    };
    await insertLedger(db, p);
    await resolveLedger(db, [{ id: 'p1', resolved: 'broken' }], 20);
    await resolveLedger(db, [{ id: 'p1', resolved: 'kept' }], 30);
    expect(await listLedger(db)).toEqual([{ ...p, resolved: 'broken', resolvedAt: 20 }]);
  });
});

describe('coins, achievements, inventory', () => {
  it('keeps the wallet equal to the sum of grants, ignoring repeated keys', async () => {
    await grantCoins(db, { key: 'day:2026-11-01', delta: 5, reason: 'Tracking day' }, 1);
    await grantCoins(db, { key: 'day:2026-11-01', delta: 5, reason: 'Tracking day' }, 2);
    await grantCoins(db, { key: 'ach:first_receipt', delta: 25, reason: 'First Receipt' }, 3);
    expect(await walletBalance(db)).toBe(30);
    expect((await listCoinTx(db)).map((g) => g.key)).toEqual([
      'day:2026-11-01',
      'ach:first_receipt',
    ]);
  });

  it('spends atomically and never goes below zero', async () => {
    await grantCoins(db, { key: 'g', delta: 20, reason: 'x' }, 1);
    expect(await spendCoins(db, { key: 'buy:1', delta: -30, reason: 'Pizza' }, 2)).toBe(false);
    expect(await walletBalance(db)).toBe(20);
    expect(await spendCoins(db, { key: 'buy:2', delta: -20, reason: 'Cannoli' }, 3)).toBe(true);
    expect(await spendCoins(db, { key: 'buy:2', delta: -20, reason: 'Cannoli' }, 4)).toBe(false);
    expect(await walletBalance(db)).toBe(0);
  });

  it('saves achievement progress and unlocks', async () => {
    await saveAchievements(db, { paper_trail: { progress: 3, unlockedAt: null } });
    await saveAchievements(db, { paper_trail: { progress: 5, unlockedAt: 99 } });
    expect(await listAchievements(db)).toEqual({ paper_trail: { progress: 5, unlockedAt: 99 } });
  });

  it('keeps bought items across restarts', async () => {
    await saveInventory(db, [{ itemId: 'rug', equipped: true }], 1);
    await saveInventory(
      db,
      [
        { itemId: 'rug', equipped: false },
        { itemId: 'blue_tie', equipped: true },
      ],
      2,
    );
    expect(await listInventory(db)).toEqual([
      { itemId: 'rug', equipped: false },
      { itemId: 'blue_tie', equipped: true },
    ]);
  });
});

describe('notification log', () => {
  it('keeps fired notifications and replaces upcoming ones', async () => {
    await replaceUpcoming(
      db,
      [
        { id: 'a', kind: 'quiet_nudge', at: 100 },
        { id: 'b', kind: 'sitdown', at: 300 },
      ],
      0,
    );
    await markOpened(db, 'a');
    await replaceUpcoming(db, [{ id: 'c', kind: 'proactive_call', at: 400 }], 200);
    expect(await listNotificationLog(db)).toEqual([
      { id: 'a', kind: 'quiet_nudge', at: 100, opened: true },
      { id: 'c', kind: 'proactive_call', at: 400, opened: false },
    ]);
  });
});

describe('categories', () => {
  const coins = {
    id: 'c1',
    label: 'Coins',
    kind: 'discretionary' as const,
    color: '#123456',
  };

  it('keeps custom categories, and marks removed ones', async () => {
    await insertCustomCategory(db, coins, 1);
    expect(await listCustomCategories(db)).toEqual([{ ...coins, custom: true, archived: false }]);
    await archiveCustomCategory(db, 'c1');
    expect((await listCustomCategories(db))[0].archived).toBe(true);
  });

  it('saves, replaces and clears limits', async () => {
    await saveCategoryLimit(db, 'coffee', 500);
    await saveCategoryLimit(db, 'coffee', 700);
    await saveCategoryLimit(db, 'fun', 900);
    expect(await listCategoryLimits(db)).toEqual({ coffee: 700, fun: 900 });
    await saveCategoryLimit(db, 'coffee', null);
    expect(await listCategoryLimits(db)).toEqual({ fun: 900 });
  });

  it('clears everything on delete-all', async () => {
    await insertCustomCategory(db, coins, 1);
    await saveCategoryLimit(db, 'coffee', 500);
    await clearCategories(db);
    expect(await listCustomCategories(db)).toEqual([]);
    expect(await listCategoryLimits(db)).toEqual({});
  });
});
