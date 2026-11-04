// The user's own categories, and their own limits for any category.

import type { Category, CategoryKind } from '@/domain/categories';

import { Db } from '../db';

type Row = {
  id: string;
  label: string;
  kind: CategoryKind;
  color: string;
  archived: number;
};

export async function listCustomCategories(db: Db): Promise<Category[]> {
  const rows = await db.all<Row>('SELECT * FROM custom_categories ORDER BY created_at');
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    color: r.color,
    custom: true,
    archived: r.archived === 1,
  }));
}

export async function insertCustomCategory(db: Db, c: Category, now: number): Promise<void> {
  await db.run(
    'INSERT INTO custom_categories (id, label, kind, color, created_at) VALUES (?, ?, ?, ?, ?)',
    [c.id, c.label, c.kind, c.color, now],
  );
}

export async function archiveCustomCategory(db: Db, id: string): Promise<void> {
  await db.run('UPDATE custom_categories SET archived = 1 WHERE id = ?', [id]);
}

export async function listCategoryLimits(db: Db): Promise<Record<string, number>> {
  const rows = await db.all<{ category: string; limit_minor: number }>(
    'SELECT * FROM category_limits',
  );
  return Object.fromEntries(rows.map((r) => [r.category, r.limit_minor]));
}

/** Sets the user's own limit, or clears it with null. */
export async function saveCategoryLimit(
  db: Db,
  category: string,
  limitMinor: number | null,
): Promise<void> {
  if (limitMinor === null) {
    await db.run('DELETE FROM category_limits WHERE category = ?', [category]);
    return;
  }
  await db.run(
    'INSERT INTO category_limits (category, limit_minor) VALUES (?, ?) ' +
      'ON CONFLICT (category) DO UPDATE SET limit_minor = excluded.limit_minor',
    [category, limitMinor],
  );
}

export async function clearCategories(db: Db): Promise<void> {
  await db.run('DELETE FROM custom_categories');
  await db.run('DELETE FROM category_limits');
}
