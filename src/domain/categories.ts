import data from '@/content/categories.json';

import type { Tier } from './reaction/tier';

export type CategoryKind = 'essential' | 'discretionary' | 'mixed';

export type Category = {
  id: string;
  label: string;
  kind: CategoryKind;
  color: string;
  /** How much of the monthly budget one purchase can be before Vinnie objects. */
  share?: number;
  /** The angriest he can get about this category, however much it was. */
  maxTier?: Tier;
  /** Added by the user. */
  custom?: boolean;
  /** Removed by the user: off the pickers, but old receipts still need its name. */
  archived?: boolean;
};

export const CATEGORIES: readonly Category[] = data as Category[];

const builtIn = new Map(CATEGORIES.map((c) => [c.id, c]));
let customs = new Map<string, Category>();

/** Tells the domain about the user's own categories. Called whenever they load or change. */
export function registerCustomCategories(list: readonly Category[]): void {
  customs = new Map(list.map((c) => [c.id, c]));
}

export function getCategory(id: string): Category {
  const c = builtIn.get(id) ?? customs.get(id);
  if (!c) throw new Error(`Unknown category '${id}'`);
  return c;
}

/** Every category that can still be picked, built-in ones first. */
export function activeCategories(): Category[] {
  return [...CATEGORIES, ...[...customs.values()].filter((c) => !c.archived)];
}

export const MAX_CATEGORY_LABEL = 20;

/** Why this name won't do for a new category, or null if it's fine. */
export function categoryNameProblem(label: string): 'empty' | 'taken' | null {
  const name = label.trim().toLowerCase();
  if (!name) return 'empty';
  return activeCategories().some((c) => c.label.toLowerCase() === name) ? 'taken' : null;
}

const CUSTOM_COLORS = ['#2E86AB', '#D64C8A', '#3AA99F', '#7D6B3D', '#5C6BC0', '#C75B39'];

/** A colour for the nth custom category. */
export const customCategoryColor = (n: number) => CUSTOM_COLORS[n % CUSTOM_COLORS.length];

export const PICKER_COLLAPSED = 8;

/**
 * What the category picker shows: most-used first, and only the first few until it's
 * expanded. The selected category is always among them, so it's never hidden.
 */
export function pickerCategories(
  categories: readonly Category[],
  usage: ReadonlyMap<string, number>,
  selected: string,
  expanded: boolean,
): { shown: Category[]; hidden: number } {
  const position = new Map(categories.map((c, i) => [c.id, i]));
  const sorted = [...categories].sort(
    (a, b) =>
      (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || position.get(a.id)! - position.get(b.id)!,
  );
  if (expanded || sorted.length <= PICKER_COLLAPSED) return { shown: sorted, hidden: 0 };
  const shown = sorted.slice(0, PICKER_COLLAPSED);
  const chosen = sorted.find((c) => c.id === selected);
  if (chosen && !shown.includes(chosen)) shown[PICKER_COLLAPSED - 1] = chosen;
  return { shown, hidden: sorted.length - PICKER_COLLAPSED };
}
