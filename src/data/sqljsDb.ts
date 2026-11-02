// Db on top of sql.js (SQLite compiled to wasm). Used on web and in tests.

import type { Database } from 'sql.js';

import { Db, SqlValue } from './db';

/** `onWrite` runs after every change, so web can save the database. */
export function wrapSqlJs(sql: Database, onWrite?: () => void): Db {
  let inTransaction = false;
  const changed = () => {
    if (!inTransaction) onWrite?.();
  };

  const all = async <T>(query: string, params: SqlValue[] = []): Promise<T[]> => {
    const stmt = sql.prepare(query);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    async exec(query) {
      sql.exec(query);
      changed();
    },
    async run(query, params = []) {
      sql.run(query, params);
      changed();
    },
    all,
    async get<T>(query: string, params: SqlValue[] = []) {
      const rows = await all<T>(query, params);
      return rows[0] ?? null;
    },
    async transaction(fn) {
      sql.exec('BEGIN');
      inTransaction = true;
      try {
        await fn();
        sql.exec('COMMIT');
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      } finally {
        inTransaction = false;
      }
      changed();
    },
  };
}
