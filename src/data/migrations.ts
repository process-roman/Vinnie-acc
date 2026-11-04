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
  `
  CREATE TABLE character_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mood INTEGER NOT NULL DEFAULT 50,
    mood_at INTEGER NOT NULL,
    crack_level INTEGER NOT NULL DEFAULT 0 CHECK (crack_level BETWEEN 0 AND 3),
    crack_seed INTEGER NOT NULL DEFAULT 1,
    impact_x REAL,
    impact_y REAL,
    last_crack_at INTEGER,
    last_call_at INTEGER,
    last_repair_day TEXT
  );

  CREATE TABLE promise_ledger (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    entry_id TEXT,
    created_at INTEGER NOT NULL,
    resolved TEXT CHECK (resolved IN ('kept', 'broken')),
    resolved_at INTEGER
  );
  `,
  `
  CREATE TABLE coin_tx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT NOT NULL UNIQUE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE achievements (
    id TEXT PRIMARY KEY,
    progress INTEGER NOT NULL DEFAULT 0,
    unlocked_at INTEGER
  );

  CREATE TABLE inventory (
    item_id TEXT PRIMARY KEY,
    equipped INTEGER NOT NULL DEFAULT 0,
    bought_at INTEGER NOT NULL
  );
  `,
  `
  ALTER TABLE settings ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE settings ADD COLUMN quiet_start INTEGER NOT NULL DEFAULT 22;
  ALTER TABLE settings ADD COLUMN quiet_end INTEGER NOT NULL DEFAULT 9;

  CREATE TABLE notification_log (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    at INTEGER NOT NULL,
    opened INTEGER NOT NULL DEFAULT 0
  );
  `,
  `
  ALTER TABLE settings ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE settings ADD COLUMN sound INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE settings ADD COLUMN haptics INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE settings ADD COLUMN analytics_id TEXT;
  `,
  `
  ALTER TABLE settings ADD COLUMN user_name TEXT NOT NULL DEFAULT '';
  UPDATE settings SET heat = 'classic' WHERE heat = 'gentle';
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
