import { describe, expect, it } from '@jest/globals';

import { drawLine, getPixel, hex, packSheet, spriteFromRows } from '../pixels';
import { buildVinnieIdleSheet, IDLE_FRAMES, VINNIE_H, VINNIE_W } from '../sprites/vinnie';

describe('pixels', () => {
  const pal = { a: hex('#ff0000'), b: hex('#0000ff') };

  it('builds sprites from rows with transparency', () => {
    const s = spriteFromRows(['a.', '.b'], pal);
    expect(getPixel(s, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(s, 1, 0)[3]).toBe(0);
    expect(getPixel(s, 1, 1)).toEqual([0, 0, 255, 255]);
  });

  it('rejects ragged rows and unknown palette keys', () => {
    expect(() => spriteFromRows(['aa', 'a'], pal)).toThrow(/length/);
    expect(() => spriteFromRows(['ax'], pal)).toThrow(/unknown/);
  });

  it('packs frames side by side', () => {
    const f = spriteFromRows(['a'], pal);
    const g = spriteFromRows(['b'], pal);
    const sheet = packSheet([f, g]);
    expect(sheet.width).toBe(2);
    expect(getPixel(sheet, 1, 0)).toEqual(pal.b);
  });

  it('draws lines that reach both endpoints', () => {
    const s = spriteFromRows(['....', '....', '....'], pal);
    drawLine(s, 0, 0, 3, 2, pal.a);
    expect(getPixel(s, 0, 0)).toEqual(pal.a);
    expect(getPixel(s, 3, 2)).toEqual(pal.a);
  });

  it('builds a Vinnie idle sheet with one frame per idle step', () => {
    const sheet = buildVinnieIdleSheet();
    expect(sheet.width).toBe(VINNIE_W * IDLE_FRAMES.length);
    expect(sheet.height).toBe(VINNIE_H);
    // Feet stay planted while the upper body breathes.
    const shoeRow = VINNIE_H - 1;
    for (let i = 1; i < IDLE_FRAMES.length; i++) {
      expect(getPixel(sheet, i * VINNIE_W + 1, shoeRow)).toEqual(getPixel(sheet, 1, shoeRow));
    }
  });
});
