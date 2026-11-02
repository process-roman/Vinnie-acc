import { describe, expect, it } from '@jest/globals';

import { composeSnapshot, scaleNearest } from '../composition';
import { getPixel } from '../pixels';
import {
  rasterizeLightning,
  rasterizePoster,
  rasterizeRoom,
  rasterizeWindow,
  RAIN_FRAMES,
  ROOM_H,
  ROOM_W,
} from '../room';
import {
  buildPlant,
  buildReceiptPile,
  CAT_SITTING,
  CAT_SLEEPING,
  ESPRESSO,
  LAMP,
  PHONE,
  STEAM_FRAMES,
} from '../sprites/props';

const opaque = (b: { data: Uint8Array }) => b.data.filter((v, i) => i % 4 === 3 && v > 0).length;

describe('prop sprites', () => {
  it('build every plant state at one size', () => {
    const sizes = (['healthy', 'droopy', 'wilted', 'dead'] as const).map((s) => {
      const p = buildPlant(s);
      return `${p.width}x${p.height}`;
    });
    expect(new Set(sizes).size).toBe(1);
  });

  it('grow the receipt pile with the count', () => {
    expect(opaque(buildReceiptPile(10))).toBeGreaterThan(opaque(buildReceiptPile(2)));
    expect(opaque(buildReceiptPile(2))).toBeGreaterThan(opaque(buildReceiptPile(0)));
    expect(opaque(buildReceiptPile(99))).toBe(opaque(buildReceiptPile(14)));
  });

  it('keep animation frames the same size', () => {
    for (const frames of [CAT_SLEEPING, CAT_SITTING, STEAM_FRAMES]) {
      expect(new Set(frames.map((f) => `${f.width}x${f.height}`)).size).toBe(1);
    }
    for (const s of [PHONE, LAMP, ESPRESSO]) expect(opaque(s)).toBeGreaterThan(0);
  });
});

describe('wall layers', () => {
  it('are room-sized and only cover their area', () => {
    for (const layer of [
      rasterizeWindow('sunny'),
      rasterizePoster('cracked'),
      rasterizeLightning(),
    ]) {
      expect([layer.width, layer.height]).toEqual([ROOM_W, ROOM_H]);
      const n = opaque(layer);
      expect(n).toBeGreaterThan(50);
      expect(n).toBeLessThan(ROOM_W * ROOM_H * 0.2);
    }
  });

  it('animates rain', () => {
    const frames = Array.from({ length: RAIN_FRAMES }, (_, i) => rasterizeWindow('rain', i));
    expect(frames[0].data).not.toEqual(frames[1].data);
  });

  it('shows the crack on the poster only when over budget', () => {
    expect(rasterizePoster('intact').data).not.toEqual(rasterizePoster('cracked').data);
  });

  it('leaves the base room without a window', () => {
    const room = rasterizeRoom();
    const win = rasterizeWindow('sunny');
    // Somewhere in the window, the room underneath is plain brick.
    let differs = false;
    for (let y = 0; y < ROOM_H && !differs; y++) {
      for (let x = 0; x < ROOM_W && !differs; x++) {
        if (getPixel(win, x, y)[3] > 0 && getPixel(room, x, y)[3] > 0) differs = true;
      }
    }
    expect(differs).toBe(true);
  });
});

describe('share snapshot', () => {
  const room = {
    plant: 'dead' as const,
    weather: 'storm' as const,
    poster: 'cracked' as const,
    receipts: 5,
    espressoSteaming: false,
    cat: 'hiding' as const,
    streak: 0,
  };
  const white = (b: { data: Uint8Array }) => {
    let n = 0;
    for (let i = 0; i < b.data.length; i += 4) {
      if (b.data[i] === 255 && b.data[i + 1] === 255 && b.data[i + 2] === 255) n++;
    }
    return n;
  };

  it('draws the office with the crack over it', () => {
    const base = { room, cosmetics: {}, vinnieFrame: 16, at: { gx: 7, gy: 7 }, crackSeed: 3 };
    const clean = composeSnapshot({ ...base, crackLevel: 0 });
    const cracked = composeSnapshot({ ...base, crackLevel: 3 });
    expect([clean.width, clean.height]).toEqual([ROOM_W, ROOM_H]);
    expect(white(cracked)).toBeGreaterThan(white(clean) + 50);
  });

  it('scales up without blurring', () => {
    const s = scaleNearest(rasterizeRoom(), 3);
    expect(s.width).toBe(ROOM_W * 3);
    expect(getPixel(s, 3 * 64 + 2, 3 * 100 + 1)).toEqual(getPixel(rasterizeRoom(), 64, 100));
  });
});
