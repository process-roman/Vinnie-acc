// Isometric (2:1) grid math, in art pixels (before display scaling).
// Grid point (0, 0) is the room's back corner; +gx runs down-right, +gy down-left.

export const TILE_W = 32;
export const TILE_H = 16;

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

/** A point on a path; `lift` raises it off the floor, in pixels. */
export type PathPoint = GridPoint & { lift?: number };

/** Where a path has got to at t (0..1) at an even speed, and which way it's heading on screen. */
export function pointOnPath(
  path: readonly PathPoint[],
  t: number,
): { gx: number; gy: number; lift: number; facing: number } {
  'worklet';
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].gx - path[i - 1].gx, path[i].gy - path[i - 1].gy);
  }
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.gx - a.gx, b.gy - a.gy);
    if (left <= len || i === path.length - 1) {
      const k = len > 0 ? Math.min(1, left / len) : 1;
      return {
        gx: a.gx + (b.gx - a.gx) * k,
        gy: a.gy + (b.gy - a.gy) * k,
        lift: (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * k,
        // Screen x grows with gx and shrinks with gy.
        facing: b.gx - a.gx - (b.gy - a.gy) < 0 ? -1 : 1,
      };
    }
    left -= len;
  }
  const end = path[path.length - 1];
  return { gx: end.gx, gy: end.gy, lift: end.lift ?? 0, facing: 1 };
}
