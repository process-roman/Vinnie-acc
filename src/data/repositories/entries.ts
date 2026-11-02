import type { Entry, EntryType } from '@/domain/entries';
import type { Tier } from '@/domain/reaction/tier';

import { Db } from '../db';

export type StoredEntry = Entry & {
  isExample: boolean;
  /** Vinnie's verdict when it was logged; shown in History. */
  tier: Tier | null;
  updatedAt: number;
};

type Row = {
  id: string;
  type: EntryType;
  amount_minor: number;
  category: string;
  description: string;
  date: string;
  is_example: number;
  reaction_tier: Tier | null;
  created_at: number;
  updated_at: number;
};

const fromRow = (r: Row): StoredEntry => ({
  id: r.id,
  type: r.type,
  amountMinor: r.amount_minor,
  category: r.category,
  description: r.description,
  date: r.date,
  isExample: r.is_example === 1,
  tier: r.reaction_tier,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** All live (not deleted) entries, oldest first. */
export async function listEntries(db: Db): Promise<StoredEntry[]> {
  const rows = await db.all<Row>(
    'SELECT * FROM entries WHERE deleted_at IS NULL ORDER BY date, created_at',
  );
  return rows.map(fromRow);
}

export async function insertEntry(db: Db, e: StoredEntry): Promise<void> {
  await db.run(
    `INSERT INTO entries (id, type, amount_minor, category, description, date, is_example,
       reaction_tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.type,
      e.amountMinor,
      e.category,
      e.description,
      e.date,
      e.isExample ? 1 : 0,
      e.tier,
      e.createdAt,
      e.updatedAt,
    ],
  );
}

export type EntryEdit = Pick<Entry, 'type' | 'amountMinor' | 'category' | 'description' | 'date'>;

export async function updateEntry(db: Db, id: string, edit: EntryEdit, now: number): Promise<void> {
  await db.run(
    `UPDATE entries SET type = ?, amount_minor = ?, category = ?, description = ?, date = ?,
       updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [edit.type, edit.amountMinor, edit.category, edit.description, edit.date, now, id],
  );
}

/** Soft delete: the row stays, so it could be restored or synced later. */
export async function deleteEntry(db: Db, id: string, now: number): Promise<void> {
  await db.run('UPDATE entries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [now, id]);
}

export async function deleteExamples(db: Db, now: number): Promise<void> {
  await db.run('UPDATE entries SET deleted_at = ? WHERE is_example = 1 AND deleted_at IS NULL', [
    now,
  ]);
}

/** Wipes every entry (Reset in playtest controls; Delete All Data later). */
export async function clearEntries(db: Db): Promise<void> {
  await db.run('DELETE FROM entries');
}
