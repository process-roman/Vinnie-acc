import { describe, expect, it } from '@jest/globals';

import {
  buildPortraitBackground,
  buildPortraitBlink,
  buildPortraitBody,
  buildPortraitHeadSheet,
  PORTRAIT_MOUTHS,
  PORTRAIT_SIZE,
} from '../sprites/portrait';

const frame = (sheet: { data: Uint8Array; width: number }, i: number) => {
  const out: number[] = [];
  for (let y = 0; y < PORTRAIT_SIZE; y++) {
    const from = (y * sheet.width + i * PORTRAIT_SIZE) * 4;
    out.push(...sheet.data.subarray(from, from + PORTRAIT_SIZE * 4));
  }
  return out.join();
};

describe('talking head', () => {
  it('has a different picture for every mouth and brow', () => {
    const sheet = buildPortraitHeadSheet();
    const frames = PORTRAIT_MOUTHS * 2;
    expect(sheet.width).toBe(PORTRAIT_SIZE * frames);
    const all = Array.from({ length: frames }, (_, i) => frame(sheet, i));
    expect(new Set(all).size).toBe(frames);
  });

  it('builds its still layers at the portrait size', () => {
    for (const b of [buildPortraitBackground(), buildPortraitBody(), buildPortraitBlink()]) {
      expect([b.width, b.height]).toEqual([PORTRAIT_SIZE, PORTRAIT_SIZE]);
    }
  });
});
