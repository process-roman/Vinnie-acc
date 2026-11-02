import { describe, expect, it } from '@jest/globals';

import { CrackLevel, generateCrack, rasterizeCrack } from '../crack';

const totalLength = (level: CrackLevel) =>
  generateCrack(level, 130, 280, 42).reduce(
    (sum, s) => sum + Math.hypot(s.x1 - s.x0, s.y1 - s.y0),
    0,
  );

describe('crack', () => {
  it('has nothing at level 0', () => {
    expect(generateCrack(0, 130, 280, 42)).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    expect(generateCrack(2, 130, 280, 7)).toEqual(generateCrack(2, 130, 280, 7));
    expect(generateCrack(2, 130, 280, 7)).not.toEqual(generateCrack(2, 130, 280, 8));
  });

  it('spreads further at each level', () => {
    expect(totalLength(2)).toBeGreaterThan(totalLength(1));
    expect(totalLength(3)).toBeGreaterThan(totalLength(2));
  });

  it('keeps the level 1 crack inside the level 2 crack', () => {
    const l1 = generateCrack(1, 130, 280, 42);
    const l2 = generateCrack(2, 130, 280, 42);
    // Every hairline segment starts on a segment of the bigger crack.
    for (const s of l1) {
      expect(l2.some((t) => t.x0 === s.x0 && t.y0 === s.y0)).toBe(true);
    }
  });

  it('rasterizes into a buffer of the requested size', () => {
    const buf = rasterizeCrack(3, 130, 280, 42);
    expect(buf.width).toBe(130);
    expect(buf.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });
});
