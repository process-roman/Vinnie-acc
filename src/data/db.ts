// The small slice of SQLite the repositories need. Implemented by expo-sqlite on
// devices and by sql.js on web and in tests, so the SQL is the same everywhere.

export type SqlValue = string | number | null;

export interface Db {
  /** Runs one or more statements with no parameters (schema, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs `fn` in a transaction; rolls back if it throws. */
  transaction(fn: () => Promise<void>): Promise<void>;
}
