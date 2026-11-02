import { describe, expect, it } from '@jest/globals';

import { normalizeMerchant } from '../merchant';
import { parseQuickAdd } from '../quickAdd';

describe('parseQuickAdd', () => {
  it('reads all parameters', () => {
    expect(parseQuickAdd({ amount: '12.50', merchant: 'Starbucks', category: 'coffee' })).toEqual({
      amountMinor: 1250,
      merchant: 'Starbucks',
      category: 'coffee',
    });
  });

  it('accepts a category label', () => {
    expect(parseQuickAdd({ category: 'Dining Out' }).category).toBe('dining');
  });

  it('drops bad parameters safely', () => {
    expect(parseQuickAdd({ amount: '-3', merchant: '   ', category: 'yachts' })).toEqual({});
    expect(
      parseQuickAdd({ amount: 'DROP TABLE', merchant: 'x'.repeat(200) }).merchant,
    ).toHaveLength(60);
    expect(parseQuickAdd({})).toEqual({});
  });

  it('takes the first of repeated parameters', () => {
    expect(parseQuickAdd({ amount: ['5', '9'] }).amountMinor).toBe(500);
  });
});

describe('normalizeMerchant', () => {
  it('ignores case, punctuation and store numbers', () => {
    expect(normalizeMerchant('STARBUCKS #1234')).toBe('starbucks');
    expect(normalizeMerchant("Joe's Pizza - Bleecker St.")).toBe('joe s pizza bleecker st');
    expect(normalizeMerchant('  ##  ')).toBe('');
  });
});
