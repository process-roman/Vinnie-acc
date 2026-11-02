import { describe, expect, it } from '@jest/globals';

import { formatMoney, keypadToMinor, pressKey } from '../money';

describe('money', () => {
  it('reads keypad digits as cents', () => {
    expect(keypadToMinor('')).toBe(0);
    expect(keypadToMinor('5')).toBe(5);
    expect(keypadToMinor('1250')).toBe(1250);
    expect(keypadToMinor('00')).toBe(0);
  });

  it('applies keypad keys', () => {
    let d = '';
    for (const k of ['0', '0', '1', '2', '00']) d = pressKey(d, k);
    expect(d).toBe('1200');
    expect(pressKey(d, 'back')).toBe('120');
    expect(pressKey('', 'back')).toBe('');
  });

  it('caps the number of digits', () => {
    expect(pressKey('99999999', '1')).toBe('99999999');
  });

  it('formats dollars', () => {
    expect(formatMoney(1250)).toBe('$12.50');
    expect(formatMoney(120000)).toBe('$1,200.00');
    expect(formatMoney(1200, 'USD', { trimZeroCents: true })).toBe('$12');
    expect(formatMoney(1250, 'USD', { trimZeroCents: true })).toBe('$12.50');
  });
});
