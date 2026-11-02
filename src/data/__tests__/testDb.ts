import initSqlJs from 'sql.js';

import { Db } from '../db';
import { migrate } from '../migrations';
import { wrapSqlJs } from '../sqljsDb';

/** A fresh, migrated in-memory database. */
export async function createTestDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const db = wrapSqlJs(new SQL.Database());
  await migrate(db);
  return db;
}
