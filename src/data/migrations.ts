import { Db } from './db';

/**
 * Schema migrations, applied in order. Never edit a shipped migration: add a new one.
 * The database's `user_version` records how many have run.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    currency TEXT NOT NULL DEFAULT 'USD',
    heat TEXT NOT NULL DEFAULT 'classic',
    last_category TEXT NOT NULL DEFAULT 'coffee',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('expense', 'saved', 'skipped')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    is_example INTEGER NOT NULL DEFAULT 0,
    reaction_tier TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX entries_date ON entries (date);

  CREATE TABLE budgets (
    month TEXT PRIMARY KEY,
    limit_minor INTEGER NOT NULL CHECK (limit_minor >= 0)
  );

  CREATE TABLE merchant_categories (
    merchant TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;
  for (let i = from; i < MIGRATIONS.length; i++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[i]);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}
