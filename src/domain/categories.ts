import data from '@/content/categories.json';

export type CategoryKind = 'essential' | 'discretionary' | 'mixed';

export type Category = {
  id: string;
  label: string;
  kind: CategoryKind;
  color: string;
};

export const CATEGORIES: readonly Category[] = data as Category[];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown category '${id}'`);
  return c;
}
