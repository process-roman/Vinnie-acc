import { describe, expect, it } from '@jest/globals';

import { drawLine, getPixel, hex, packSheet, spriteFromRows } from '../pixels';
import {
  ANIM_NAMES,
  ANIMS,
  buildVinnieSheet,
  VINNIE_FRAME_COUNT,
  VINNIE_H,
  VINNIE_W,
} from '../sprites/vinnie';

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

  it('builds the Vinnie sheet, and every animation points at real frames', () => {
    const sheet = buildVinnieSheet();
    expect(sheet.width).toBe(VINNIE_W * VINNIE_FRAME_COUNT);
    expect(sheet.height).toBe(VINNIE_H);
    for (const name of ANIM_NAMES) {
      for (const f of ANIMS[name].frames) expect(f).toBeLessThan(VINNIE_FRAME_COUNT);
    }
    // Feet stay planted while idling: the shoe row matches across idle frames.
    const shoe = VINNIE_H - 1;
    const [a, b] = [ANIMS.idle.frames[0], ANIMS.idle.frames[2]];
    expect(getPixel(sheet, b * VINNIE_W + 1, shoe)).toEqual(
      getPixel(sheet, a * VINNIE_W + 1, shoe),
    );
  });
});
