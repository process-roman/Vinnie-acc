// Device database: expo-sqlite. Web uses open.web.ts.

import * as SQLite from 'expo-sqlite';

import { Db } from './db';
import { migrate } from './migrations';

export const DB_NAME = 'vinnie.db';

export async function openDb(): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync(DB_NAME);
  await sqlite.execAsync('PRAGMA journal_mode = WAL;');
  const db: Db = {
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params = []) => {
      await sqlite.runAsync(sql, params);
    },
    all: (sql, params = []) => sqlite.getAllAsync(sql, params),
    get: (sql, params = []) => sqlite.getFirstAsync(sql, params),
    transaction: (fn) => sqlite.withTransactionAsync(fn),
  };
  await migrate(db);
  return db;
}
