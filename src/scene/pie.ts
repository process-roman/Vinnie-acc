// The spending pie, drawn as pixel art like everything else: a ring of slices clockwise
// from 12 o'clock, with a gap between them and a pulled-out slice when one is picked.

import type { Slice } from '@/domain/spending';

import { createBuffer, hex, PixelBuffer, setPixel } from './pixels';

export const PIE_SIZE = 112;
export const PIE_OUTER = PIE_SIZE / 2;
export const PIE_INNER = PIE_SIZE * 0.3;
/** How far unpicked slices shrink back when one is picked. */
const PICK_INSET = 4;
const FADED_ALPHA = 90;

export function rasterizePie(slices: readonly Slice[], selected: string | null): PixelBuffer {
  const buf = createBuffer(PIE_SIZE, PIE_SIZE);
  const total = slices.reduce((sum, s) => sum + s.totalMinor, 0);
  if (!total) return buf;
  const ends: number[] = [];
  let reached = 0;
  for (const s of slices) {
    reached += s.totalMinor / total;
    ends.push(reached);
  }
  const colors = slices.map((s) => hex(s.color));
  const c = PIE_SIZE / 2;
  for (let y = 0; y < PIE_SIZE; y++) {
    for (let x = 0; x < PIE_SIZE; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r < PIE_INNER || r > PIE_OUTER) continue;
      const turn = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
      const i = Math.max(
        0,
        ends.findIndex((end) => turn < end),
      );
      const picked = selected === slices[i].id;
      if (selected && !picked && r > PIE_OUTER - PICK_INSET) continue;
      if (slices.length > 1) {
        // A gap about a pixel and a half wide along each slice's edges.
        const start = i === 0 ? 0 : ends[i - 1];
        const away = Math.min(turn - start, ends[i] - turn) * Math.PI * 2 * r;
        if (away < 0.75) continue;
      }
      const [red, green, blue] = colors[i];
      setPixel(buf, x, y, [red, green, blue, selected && !picked ? FADED_ALPHA : 255]);
    }
  }
  return buf;
}
