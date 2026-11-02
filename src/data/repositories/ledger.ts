import type { LedgerEntry, LedgerEvent } from '@/domain/reaction/ledger';

import { Db } from '../db';

type Row = {
  id: string;
  tag: string;
  category: string;
  amount_minor: number;
  entry_id: string | null;
  created_at: number;
  resolved: 'kept' | 'broken' | null;
  resolved_at: number | null;
};

export async function listLedger(db: Db): Promise<LedgerEntry[]> {
  const rows = await db.all<Row>('SELECT * FROM promise_ledger ORDER BY created_at');
  return rows.map((r) => ({
    id: r.id,
    tag: r.tag,
    category: r.category,
    amountMinor: r.amount_minor,
    entryId: r.entry_id,
    createdAt: r.created_at,
    resolved: r.resolved,
    resolvedAt: r.resolved_at,
  }));
}

export async function insertLedger(db: Db, l: LedgerEntry): Promise<void> {
  await db.run(
    `INSERT INTO promise_ledger (id, tag, category, amount_minor, entry_id, created_at, resolved,
       resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [l.id, l.tag, l.category, l.amountMinor, l.entryId, l.createdAt, l.resolved, l.resolvedAt],
  );
}

export async function resolveLedger(db: Db, events: LedgerEvent[], now: number): Promise<void> {
  for (const e of events) {
    await db.run(
      'UPDATE promise_ledger SET resolved = ?, resolved_at = ? WHERE id = ? AND resolved IS NULL',
      [e.resolved, now, e.id],
    );
  }
}

export async function clearLedger(db: Db): Promise<void> {
  await db.run('DELETE FROM promise_ledger');
}
