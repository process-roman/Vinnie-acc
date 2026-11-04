// Where every sprite sits in the office, and how it's depth-sorted against Vinnie.

import type { PropTarget } from '@/domain/propLines';

import { depth, GridPoint, gridToScreen } from './iso';
import { PixelBuffer } from './pixels';
import { propById, PropId, ROOM_ORIGIN } from './room';

export type Slot = {
  /** Grid point the sprite stands on (for items on furniture: the point under them). */
  at: GridPoint;
  /** Pixel in the sprite that sits on that point (usually bottom-centre). */
  anchor: { x: number; y: number };
  /** Raise by this many pixels, e.g. the height of the furniture it sits on. */
  lift?: number;
  /** Sort with this piece of furniture (just in front of it) instead of by its own point. */
  on?: PropId;
};

/** Top-left pixel position for a sprite in a slot. */
export function slotPosition(slot: Slot): { x: number; y: number } {
  const p = gridToScreen(slot.at, ROOM_ORIGIN);
  return {
    x: Math.round(p.x - slot.anchor.x),
    y: Math.round(p.y - (slot.lift ?? 0) - slot.anchor.y),
  };
}

const furnitureDepth = (id: PropId) => {
  const f = propById(id).footprint;
  return depth({ gx: f.gx + f.w / 2, gy: f.gy + f.d / 2 });
};

export function slotDepth(slot: Slot, order = 0): number {
  return slot.on ? furnitureDepth(slot.on) + 0.01 * (order + 1) : depth(slot.at);
}

const DESK_TOP = propById('desk').heightPx;
const CABINET_TOP = propById('cabinet').heightPx;

export const SLOTS = {
  plant: { at: { gx: 0.65, gy: 1.85 }, anchor: { x: 18, y: 63 } },
  pile: { at: { gx: 2.5, gy: 3.9 }, anchor: { x: 39, y: 26 } },
  lamp: { at: { gx: 3.3, gy: 2.3 }, anchor: { x: 8, y: 19 }, lift: DESK_TOP, on: 'desk' },
  phone: { at: { gx: 4.72, gy: 3 }, anchor: { x: 8, y: 10 }, lift: DESK_TOP, on: 'desk' },
  catOnDesk: { at: { gx: 4.25, gy: 2.6 }, anchor: { x: 10, y: 9 }, lift: DESK_TOP, on: 'desk' },
  catOnFloor: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 7, y: 19 } },
  catBed: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 13, y: 9 } },
  catInBed: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 7, y: 19 }, lift: 3 },
  espresso: {
    at: { gx: 0.52, gy: 4.95 },
    anchor: { x: 10, y: 24 },
    lift: CABINET_TOP,
    on: 'cabinet',
  },
  steam: {
    at: { gx: 0.52, gy: 4.95 },
    anchor: { x: 5, y: 37 },
    lift: CABINET_TOP,
    on: 'cabinet',
  },
} satisfies Record<string, Slot>;

/** A drawable sprite in the scene: one or more frames, a position, a depth. */
export type SceneSprite = {
  key: string;
  frames: PixelBuffer[];
  /** Milliseconds per frame when animated. */
  frameMs?: number;
  x: number;
  y: number;
  depth: number;
  tap?: PropTarget;
};
