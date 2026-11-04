import { describe, expect, it } from '@jest/globals';

import { depth, gridToScreen, inFootprint, pointOnPath, screenToGrid } from '../iso';

describe('iso', () => {
  const origin = { x: 64, y: 48 };

  it('places grid axes on the 2:1 diagonals', () => {
    expect(gridToScreen({ gx: 0, gy: 0 }, origin)).toEqual({ x: 64, y: 48 });
    expect(gridToScreen({ gx: 1, gy: 0 }, origin)).toEqual({ x: 80, y: 56 });
    expect(gridToScreen({ gx: 0, gy: 1 }, origin)).toEqual({ x: 48, y: 56 });
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

describe('pointOnPath', () => {
  const path = [
    { gx: 0, gy: 0, lift: 10 },
    { gx: 2, gy: 0 },
    { gx: 2, gy: 2 },
  ];

  it('walks the path at an even speed', () => {
    expect(pointOnPath(path, 0)).toMatchObject({ gx: 0, gy: 0, lift: 10 });
    expect(pointOnPath(path, 0.25)).toMatchObject({ gx: 1, gy: 0, lift: 5 });
    expect(pointOnPath(path, 1)).toMatchObject({ gx: 2, gy: 2, lift: 0 });
  });

  it('faces the way it is heading on screen', () => {
    expect(pointOnPath(path, 0.25).facing).toBe(1);
    expect(pointOnPath(path, 0.75).facing).toBe(-1);
  });
});
