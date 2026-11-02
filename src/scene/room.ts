// Placeholder office, rasterised as pixel art. Replaced by real art later via the
// same PixelBuffer -> SkImage path (or PNGs from a sprite manifest).

import { Footprint, Point, screenToGrid, TILE_H, TILE_W } from './iso';
import { createBuffer, hex, PixelBuffer, Rgba, setPixel } from './pixels';

export const ROOM_TILES = 8;
export const WALL_H = 48;

export const ROOM_W = ROOM_TILES * TILE_W;
export const ROOM_H = WALL_H + ROOM_TILES * TILE_H;
/** Screen position of grid (0, 0), the back corner of the floor. */
export const ROOM_ORIGIN: Point = { x: ROOM_TILES * (TILE_W / 2), y: WALL_H };

const C = {
  plankA: hex('#9a5b34'),
  plankB: hex('#8d522f'),
  seam: hex('#6e3f24'),
  brickR: hex('#a4523a'),
  mortarR: hex('#c98c6c'),
  brickL: hex('#8c4430'),
  mortarL: hex('#b3765a'),
  trim: hex('#5b2e1e'),
  frame: hex('#ece4d2'),
  sky: hex('#8fc5e8'),
  skyLow: hex('#b9dcef'),
  skyline: hex('#6d7f99'),
};

const frac = (n: number) => n - Math.floor(n);

function floorColor(gx: number, gy: number): Rgba {
  // Planks run along gx; seams every half tile across gy, staggered joints along gx.
  const plank = Math.floor(gy * 2);
  if (frac(gy * 2) < 0.12) return C.seam;
  if (frac(gx + (plank % 2) * 0.5) < 0.04) return C.seam;
  return plank % 2 === 0 ? C.plankA : C.plankB;
}

function brick(u: number, v: number, brickC: Rgba, mortarC: Rgba): Rgba {
  const row = Math.floor(v / 4);
  if (v % 4 === 0) return mortarC;
  const offset = row % 2 === 0 ? 0 : 0.5;
  if (frac(u + offset) < 0.08) return mortarC;
  return brickC;
}

/** Window on the right-hand wall, in wall coordinates (u: tiles along wall, v: px up). */
function windowColor(u: number, v: number): Rgba | null {
  const u0 = 3.5;
  const u1 = 6.5;
  const v0 = 16;
  const v1 = 40;
  if (u < u0 || u >= u1 || v < v0 || v >= v1) return null;
  const onFrame = u < u0 + 0.15 || u >= u1 - 0.15 || v < v0 + 2 || v >= v1 - 2;
  const mullion = Math.abs(u - (u0 + u1) / 2) < 0.08 || Math.abs(v - (v0 + v1) / 2) < 1;
  if (onFrame || mullion) return C.frame;
  // A stepped skyline at the bottom of the glass.
  const skylineTop = v0 + 3 + (Math.floor(u * 4) % 3) * 2;
  if (v < skylineTop) return C.skyline;
  return v < v0 + 12 ? C.skyLow : C.sky;
}

export function rasterizeRoom(): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const o = ROOM_ORIGIN;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const g = screenToGrid({ x: px, y: py }, o);
      if (g.gx >= 0 && g.gx < ROOM_TILES && g.gy >= 0 && g.gy < ROOM_TILES) {
        setPixel(buf, x, y, floorColor(g.gx, g.gy));
        continue;
      }
      const right = px >= o.x;
      const edgeY = o.y + Math.abs(px - o.x) / 2;
      const v = Math.floor(edgeY - py);
      if (v < 0 || v >= WALL_H) continue;
      const u = Math.abs(px - o.x) / (TILE_W / 2);
      if (v >= WALL_H - 2 || v < 2) {
        setPixel(buf, x, y, C.trim);
      } else if (right) {
        setPixel(buf, x, y, windowColor(u, v) ?? brick(u, v, C.brickR, C.mortarR));
      } else {
        setPixel(buf, x, y, brick(u, v, C.brickL, C.mortarL));
      }
    }
  }
  return buf;
}

export type BoxColors = { top: Rgba; left: Rgba; right: Rgba; edge: Rgba };

/**
 * Rasterises an isometric box standing on the floor into a room-sized buffer
 * (transparent elsewhere), so it can be drawn and depth-sorted as its own layer
 * and hit-tested by alpha.
 */
export function rasterizeBox(f: Footprint, heightPx: number, colors: BoxColors): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const o = ROOM_ORIGIN;
  const half = TILE_W / 2;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const top = screenToGrid({ x: px, y: py + heightPx }, o);
      const onTop = top.gx >= f.gx && top.gx < f.gx + f.w && top.gy >= f.gy && top.gy < f.gy + f.d;
      if (onTop) {
        const nearEdge =
          top.gx - f.gx < 0.08 ||
          f.gx + f.w - top.gx < 0.08 ||
          top.gy - f.gy < 0.15 ||
          f.gy + f.d - top.gy < 0.15;
        setPixel(buf, x, y, nearEdge ? colors.edge : colors.top);
        continue;
      }
      // Front-left face lies on the line gy = f.gy + f.d.
      const gyE = f.gy + f.d;
      const gxL = (px - o.x) / half + gyE;
      if (gxL >= f.gx && gxL <= f.gx + f.w) {
        const base = o.y + (gxL + gyE) * (TILE_H / 2);
        if (py < base && py >= base - heightPx) {
          setPixel(buf, x, y, colors.left);
          continue;
        }
      }
      // Front-right face lies on the line gx = f.gx + f.w.
      const gxE = f.gx + f.w;
      const gyR = gxE - (px - o.x) / half;
      if (gyR >= f.gy && gyR <= f.gy + f.d) {
        const base = o.y + (gxE + gyR) * (TILE_H / 2);
        if (py < base && py >= base - heightPx) setPixel(buf, x, y, colors.right);
      }
    }
  }
  return buf;
}

export type PropId = 'desk' | 'cabinet';

export type PropDef = {
  id: PropId;
  footprint: Footprint;
  heightPx: number;
  colors: BoxColors;
  /** Where Vinnie stands when he walks to this prop. */
  standAt: { gx: number; gy: number };
};

export const PROPS: readonly PropDef[] = [
  {
    id: 'cabinet',
    footprint: { gx: 0.2, gy: 4.5, w: 1, d: 1.2 },
    heightPx: 22,
    colors: {
      top: hex('#93a07a'),
      left: hex('#6f7c58'),
      right: hex('#5c6848'),
      edge: hex('#b2bd97'),
    },
    standAt: { gx: 1.8, gy: 5.1 },
  },
  {
    id: 'desk',
    footprint: { gx: 3, gy: 2, w: 2.5, d: 1.2 },
    heightPx: 11,
    colors: {
      top: hex('#b06a3b'),
      left: hex('#7c4526'),
      right: hex('#653720'),
      edge: hex('#c98652'),
    },
    standAt: { gx: 4.2, gy: 4 },
  },
];
