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
  plant: { at: { gx: 0.7, gy: 2.4 }, anchor: { x: 5, y: 15 } },
  pile: { at: { gx: 2.5, gy: 3.9 }, anchor: { x: 19, y: 13 } },
  lamp: { at: { gx: 3.35, gy: 2.25 }, anchor: { x: 2, y: 7 }, lift: DESK_TOP, on: 'desk' },
  phone: { at: { gx: 5.05, gy: 2.55 }, anchor: { x: 3, y: 4 }, lift: DESK_TOP, on: 'desk' },
  catOnDesk: { at: { gx: 4.3, gy: 2.6 }, anchor: { x: 4, y: 4 }, lift: DESK_TOP, on: 'desk' },
  catOnFloor: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 3, y: 8 } },
  catBed: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 6, y: 4 } },
  catInBed: { at: { gx: 6.7, gy: 2.6 }, anchor: { x: 3, y: 8 }, lift: 2 },
  espresso: {
    at: { gx: 0.7, gy: 5.1 },
    anchor: { x: 4, y: 8 },
    lift: CABINET_TOP,
    on: 'cabinet',
  },
  steam: {
    at: { gx: 0.7, gy: 5.1 },
    anchor: { x: 2, y: 14 },
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
