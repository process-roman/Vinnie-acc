import { describe, expect, it } from '@jest/globals';

import { gridToScreen } from '../iso';
import { getPixel } from '../pixels';
import { PROPS, rasterizeBox, rasterizeRoom, ROOM_ORIGIN } from '../room';

describe('room', () => {
  it('paints the floor and leaves the area below it transparent', () => {
    const room = rasterizeRoom();
    const centre = gridToScreen({ gx: 4, gy: 4 }, ROOM_ORIGIN);
    expect(getPixel(room, Math.round(centre.x), Math.round(centre.y))[3]).toBe(255);
    expect(getPixel(room, 0, room.height - 1)[3]).toBe(0);
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
