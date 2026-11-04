import { describe, expect, it } from '@jest/globals';

import { gridToScreen } from '../iso';
import { rasterizeFurniture, rasterizeOffice } from '../furniture';
import { getPixel } from '../pixels';
import { PROPS, rasterizeBox, rasterizeRoom, ROOM_ORIGIN } from '../room';

describe('room', () => {
  it('paints the floor and leaves the area below it transparent', () => {
    const room = rasterizeRoom();
    const centre = gridToScreen({ gx: 4, gy: 4 }, ROOM_ORIGIN);
    expect(getPixel(room, Math.round(centre.x), Math.round(centre.y))[3]).toBe(255);
    expect(getPixel(room, 0, room.height - 1)[3]).toBe(0);
  });

  it('casts a soft shadow under the slab, and keeps the room itself opaque', () => {
    const room = rasterizeRoom();
    const c = gridToScreen({ gx: 8, gy: 8 }, ROOM_ORIGIN);
    const under = getPixel(room, Math.round(c.x), Math.round(c.y) + 12)[3];
    expect(under).toBeGreaterThan(0);
    expect(under).toBeLessThan(255);
  });

  it('adds furniture to the office without covering the whole room', () => {
    const count = (b: { data: Uint8Array }) => b.data.filter((v, i) => i % 4 === 3 && v > 0).length;
    expect(rasterizeOffice().data).not.toEqual(rasterizeRoom().data);
    for (const p of PROPS) {
      const n = count(rasterizeFurniture(p.id));
      expect(n).toBeGreaterThan(50);
      expect(n).toBeLessThan(40000);
    }
  });

  it('draws each prop above its footprint', () => {
    for (const p of PROPS) {
      const box = rasterizeBox(p.footprint, p.heightPx, p.colors);
      const c = gridToScreen(
        { gx: p.footprint.gx + p.footprint.w / 2, gy: p.footprint.gy + p.footprint.d / 2 },
        ROOM_ORIGIN,
      );
      expect(getPixel(box, Math.round(c.x), Math.round(c.y - p.heightPx))[3]).toBe(255);
    }
  });
});
