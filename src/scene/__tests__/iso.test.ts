import { describe, expect, it } from '@jest/globals';

import { depth, gridToScreen, inFootprint, screenToGrid } from '../iso';

describe('iso', () => {
  const origin = { x: 64, y: 48 };

  it('places grid axes on the 2:1 diagonals', () => {
    expect(gridToScreen({ gx: 0, gy: 0 }, origin)).toEqual({ x: 64, y: 48 });
    expect(gridToScreen({ gx: 1, gy: 0 }, origin)).toEqual({ x: 72, y: 52 });
    expect(gridToScreen({ gx: 0, gy: 1 }, origin)).toEqual({ x: 56, y: 52 });
  });

  it('screenToGrid inverts gridToScreen', () => {
    for (const p of [
      { gx: 0, gy: 0 },
      { gx: 3.25, gy: 1.5 },
      { gx: 7.9, gy: 6.1 },
    ]) {
      const back = screenToGrid(gridToScreen(p, origin), origin);
      expect(back.gx).toBeCloseTo(p.gx);
      expect(back.gy).toBeCloseTo(p.gy);
    }
  });

  it('footprint hit test is half-open', () => {
    const f = { gx: 2, gy: 1, w: 2, d: 1 };
    expect(inFootprint({ gx: 2, gy: 1 }, f)).toBe(true);
    expect(inFootprint({ gx: 3.99, gy: 1.99 }, f)).toBe(true);
    expect(inFootprint({ gx: 4, gy: 1.5 }, f)).toBe(false);
  });

  it('things further forward sort later', () => {
    expect(depth({ gx: 3, gy: 3 })).toBeGreaterThan(depth({ gx: 1, gy: 2 }));
  });
});
