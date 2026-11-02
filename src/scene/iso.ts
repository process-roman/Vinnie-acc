// Isometric (2:1) grid math, in art pixels (before display scaling).
// Grid point (0, 0) is the room's back corner; +gx runs down-right, +gy down-left.

export const TILE_W = 16;
export const TILE_H = 8;

export type Point = { x: number; y: number };
export type GridPoint = { gx: number; gy: number };

/** Screen position of a grid point, relative to the given origin. */
export function gridToScreen({ gx, gy }: GridPoint, origin: Point): Point {
  'worklet';
  return {
    x: origin.x + (gx - gy) * (TILE_W / 2),
    y: origin.y + (gx + gy) * (TILE_H / 2),
  };
}

/** Inverse of gridToScreen, giving fractional grid coordinates on the floor plane. */
export function screenToGrid({ x, y }: Point, origin: Point): GridPoint {
  const u = (x - origin.x) / (TILE_W / 2);
  const v = (y - origin.y) / (TILE_H / 2);
  return { gx: (u + v) / 2, gy: (v - u) / 2 };
}

export type Footprint = { gx: number; gy: number; w: number; d: number };

export function inFootprint(p: GridPoint, f: Footprint): boolean {
  return p.gx >= f.gx && p.gx < f.gx + f.w && p.gy >= f.gy && p.gy < f.gy + f.d;
}

/** Painter's-order depth: larger draws later (in front). */
export function depth(p: GridPoint): number {
  return p.gx + p.gy;
}
