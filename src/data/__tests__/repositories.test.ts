import { beforeEach, describe, expect, it } from '@jest/globals';

import { Db } from '../db';
import { migrate } from '../migrations';
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
import { categoryForMerchant, learnMerchant } from '../repositories/merchants';
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
    expect(row?.user_version).toBe(1);
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
      lastCategory: 'coffee',
      createdAt: 42,
    });
    await updateSettings(db, { heat: 'gentle', lastCategory: 'dining' });
    expect(await getSettings(db, 99)).toEqual({
      currency: 'USD',
      heat: 'gentle',
      lastCategory: 'dining',
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
