import { describe, expect, it } from '@jest/globals';

import type { Slice } from '@/domain/spending';

import { getPixel, hex } from '../pixels';
import { PIE_SIZE, rasterizePie } from '../pie';

const slice = (id: string, color: string, totalMinor: number): Slice => ({
  id,
  label: id,
  color,
  totalMinor,
  percent: 0,
});
const a = slice('a', '#ff0000', 75);
const b = slice('b', '#0000ff', 25);
// A point on the ring: right of centre is in the first three quarters, left in the last.
const right = (buf: ReturnType<typeof rasterizePie>) =>
  getPixel(buf, PIE_SIZE - 10, PIE_SIZE / 2 - 12);
const left = (buf: ReturnType<typeof rasterizePie>) => getPixel(buf, 10, PIE_SIZE / 2 - 12);
const centre = (buf: ReturnType<typeof rasterizePie>) => getPixel(buf, PIE_SIZE / 2, PIE_SIZE / 2);

describe('rasterizePie', () => {
  it('draws slices clockwise with a hole in the middle', () => {
    const pie = rasterizePie([a, b], null);
    expect(right(pie)).toEqual(hex('#ff0000'));
    expect(left(pie)).toEqual(hex('#0000ff'));
    expect(centre(pie)[3]).toBe(0);
  });

  it('is empty with nothing to show', () => {
    expect(rasterizePie([], null).data.every((v) => v === 0)).toBe(true);
  });

  it('fades the rest when one slice is picked', () => {
    const pie = rasterizePie([a, b], 'a');
    expect(right(pie)[3]).toBe(255);
    expect(left(pie)[3]).toBeLessThan(255);
  });

  it('leaves a gap between slices, but not around a lone one', () => {
    const opaque = (s: Slice[]) =>
      rasterizePie(s, null).data.filter((v, i) => i % 4 === 3 && v > 0).length;
    expect(opaque([slice('x', '#00ff00', 100)])).toBeGreaterThan(opaque([a, b]));
  });
});
