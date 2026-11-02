import type { NotificationKind, NotificationLogItem } from '@/domain/notifications';

import { Db } from '../db';

type Row = { id: string; kind: NotificationKind; at: number; opened: number };

export async function listNotificationLog(
  db: Db,
): Promise<(NotificationLogItem & { id: string })[]> {
  const rows = await db.all<Row>('SELECT * FROM notification_log ORDER BY at');
  return rows.map((r) => ({ id: r.id, kind: r.kind, at: r.at, opened: r.opened === 1 }));
}

/** Replaces the not-yet-fired part of the log with a new plan. */
export async function replaceUpcoming(
  db: Db,
  planned: { id: string; kind: NotificationKind; at: number }[],
  now: number,
): Promise<void> {
  await db.transaction(async () => {
    await db.run('DELETE FROM notification_log WHERE at > ?', [now]);
    for (const p of planned) {
      await db.run('INSERT INTO notification_log (id, kind, at, opened) VALUES (?, ?, ?, 0)', [
        p.id,
        p.kind,
        p.at,
      ]);
    }
  });
}

export async function markOpened(db: Db, id: string): Promise<void> {
  await db.run('UPDATE notification_log SET opened = 1 WHERE id = ?', [id]);
}

export async function clearNotificationLog(db: Db): Promise<void> {
  await db.run('DELETE FROM notification_log');
}
