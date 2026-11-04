import { afterEach, describe, expect, it } from '@jest/globals';

import {
  activeCategories,
  CATEGORIES,
  Category,
  categoryNameProblem,
  customCategoryColor,
  getCategory,
  PICKER_COLLAPSED,
  pickerCategories,
  registerCustomCategories,
} from '../categories';
import { categoryLimit, suggestedLimit } from '../categoryLimits';

const custom = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  label: id,
  kind: 'discretionary',
  color: '#000000',
  custom: true,
  ...over,
});

afterEach(() => registerCustomCategories([]));

describe('custom categories', () => {
  it('can be looked up, and removed ones still resolve for old receipts', () => {
    registerCustomCategories([custom('coins'), custom('gone', { archived: true })]);
    expect(getCategory('coins').label).toBe('coins');
    expect(getCategory('gone').label).toBe('gone');
    const ids = activeCategories().map((c) => c.id);
    expect(ids).toContain('coins');
    expect(ids).not.toContain('gone');
  });

  it('still rejects ids nobody knows', () => {
    expect(() => getCategory('nope')).toThrow(/nope/);
  });

  it('checks names', () => {
    registerCustomCategories([custom('Coins')]);
    expect(categoryNameProblem('   ')).toBe('empty');
    expect(categoryNameProblem('coffee')).toBe('taken');
    expect(categoryNameProblem(' COINS ')).toBe('taken');
    expect(categoryNameProblem('Boat')).toBeNull();
  });

  it('cycles through colours', () => {
    expect(customCategoryColor(0)).toBe(customCategoryColor(6));
  });
});

describe('pickerCategories', () => {
  const none = new Map<string, number>();

  it("hides what doesn't fit until expanded", () => {
    const collapsed = pickerCategories(CATEGORIES, none, 'groceries', false);
    expect(collapsed.shown).toHaveLength(PICKER_COLLAPSED);
    expect(collapsed.hidden).toBe(CATEGORIES.length - PICKER_COLLAPSED);
    const open = pickerCategories(CATEGORIES, none, 'groceries', true);
    expect(open.shown).toHaveLength(CATEGORIES.length);
    expect(open.hidden).toBe(0);
  });

  it('puts what you use most first', () => {
    const { shown } = pickerCategories(CATEGORIES, new Map([['other', 9]]), 'coffee', false);
    expect(shown[0].id).toBe('other');
  });

  it('never hides the selected one', () => {
    const { shown } = pickerCategories(CATEGORIES, none, 'other', false);
    expect(shown).toHaveLength(PICKER_COLLAPSED);
    expect(shown.map((c) => c.id)).toContain('other');
  });

  it('shows everything when there are only a few', () => {
    const few = CATEGORIES.slice(0, 3);
    expect(pickerCategories(few, none, 'x', false)).toEqual({ shown: [...few], hidden: 0 });
  });
});

describe('categoryLimit', () => {
  const groceries = getCategory('groceries');
  const opts = { monthlyLimitMinor: 200000, history: [] as number[] };

  it('starts from a share of the budget, so it fits any income', () => {
    expect(categoryLimit(groceries, opts)).toEqual({ limitMinor: 20000, source: 'vinnie' });
    expect(categoryLimit(groceries, { ...opts, monthlyLimitMinor: 400000 }).limitMinor).toBe(40000);
    expect(categoryLimit(groceries, { ...opts, monthlyLimitMinor: null }).limitMinor).toBe(20000);
  });

  it('always has a number for a category it has never seen', () => {
    const boat = custom('boat');
    expect(categoryLimit(boat, opts).limitMinor).toBe(10000);
    expect(categoryLimit(custom('rent2', { kind: 'essential' }), opts).limitMinor).toBe(30000);
    expect(suggestedLimit('discretionary', 200000)).toBe(10000);
    expect(suggestedLimit('essential', null)).toBe(30000);
  });

  it('takes your number over everything', () => {
    expect(categoryLimit(groceries, { ...opts, userLimitMinor: 5000 })).toEqual({
      limitMinor: 5000,
      source: 'yours',
    });
  });

  it('learns what is normal for you, once it has seen enough', () => {
    const big = [30000, 30000, 30000];
    expect(categoryLimit(groceries, { ...opts, history: big }).source).toBe('vinnie');
    expect(categoryLimit(groceries, { ...opts, history: [...big, 30000] })).toEqual({
      limitMinor: 45000,
      source: 'learned',
    });
  });

  it('does not learn from one mad purchase', () => {
    const history = [10000, 10000, 10000, 10000, 500000];
    expect(categoryLimit(groceries, { ...opts, history }).limitMinor).toBe(20000);
  });

  it('can only be talked up so far', () => {
    const history = [500000, 500000, 500000, 500000];
    expect(categoryLimit(groceries, { ...opts, history }).limitMinor).toBe(60000);
  });

  it('rounds to numbers a person would say', () => {
    const coffee = getCategory('coffee');
    expect(categoryLimit(coffee, opts).limitMinor).toBe(800);
    expect(categoryLimit(coffee, { ...opts, monthlyLimitMinor: 123456 }).limitMinor).toBe(500);
    expect(categoryLimit(custom('x'), { ...opts, monthlyLimitMinor: 10 }).limitMinor).toBe(100);
    expect(categoryLimit(custom('y'), { ...opts, monthlyLimitMinor: 4000000 }).limitMinor).toBe(
      200000,
    );
  });

  it('handles an even number of receipts', () => {
    const history = [30000, 30000, 40000, 40000];
    expect(categoryLimit(groceries, { ...opts, history }).limitMinor).toBe(53000);
  });
});
