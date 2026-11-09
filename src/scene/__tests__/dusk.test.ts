import { describe, expect, it } from '@jest/globals';

import { buildDusk, DUSK_H, DUSK_W } from '../sprites/dusk';

describe('dusk backdrop', () => {
  it('fills its whole frame, with no holes', () => {
    const b = buildDusk();
    expect([b.width, b.height]).toEqual([DUSK_W, DUSK_H]);
    for (let i = 3; i < b.data.length; i += 4) expect(b.data[i]).toBe(255);
  });

  it('is warm toward the horizon, not one flat colour', () => {
    const b = buildDusk();
    const at = (x: number, y: number) => [
      ...b.data.subarray((y * DUSK_W + x) * 4, (y * DUSK_W + x) * 4 + 3),
    ];
    const top = at(48, 2);
    const low = at(48, 80);
    expect(low[0]).toBeGreaterThan(top[0] + 60);
  });
});
