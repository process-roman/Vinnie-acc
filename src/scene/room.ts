// Placeholder office, rasterised as pixel art. Replaced by real art later via the
// same PixelBuffer -> SkImage path (or PNGs from a sprite manifest).

import type { PosterState, Weather } from '@/domain/roomState';

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

/**
 * A point on a back wall: which wall, `u` in tiles from the corner along it, and
 * `v` in pixels up from the floor. x and y are the pixel's screen coordinates.
 */
export type WallPoint = { side: 'left' | 'right'; u: number; v: number; x: number; y: number };

/** Calls `fn` for every pixel that lies on a back wall. */
function forEachWallPixel(fn: (p: WallPoint) => void): void {
  const o = ROOM_ORIGIN;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const g = screenToGrid({ x: px, y: py }, o);
      if (g.gx >= 0 && g.gx < ROOM_TILES && g.gy >= 0 && g.gy < ROOM_TILES) continue;
      const edgeY = o.y + Math.abs(px - o.x) / 2;
      const v = Math.floor(edgeY - py);
      if (v < 0 || v >= WALL_H) continue;
      fn({ side: px >= o.x ? 'right' : 'left', u: Math.abs(px - o.x) / (TILE_W / 2), v, x, y });
    }
  }
}

/** A room-sized transparent layer painted onto the walls by `paint`. */
export function rasterizeWallLayer(paint: (p: WallPoint) => Rgba | null): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  forEachWallPixel((p) => {
    const c = paint(p);
    if (c) setPixel(buf, p.x, p.y, c);
  });
  return buf;
}

export type WallStyle = 'brick' | 'green_wallpaper';

/** Striped green wallpaper above a wood wainscot (a shop item). */
function wallpaper(u: number, v: number, shade: number): Rgba {
  if (v < 12) return v === 11 ? hex('#3b2416') : shade ? hex('#5e3a22') : hex('#6e4429');
  const stripe = Math.floor(u * 4) % 2 === 0;
  if (shade) return stripe ? hex('#2f5a3d') : hex('#386b48');
  return stripe ? hex('#3c7350') : hex('#478559');
}

export function rasterizeRoom(walls: WallStyle = 'brick'): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const o = ROOM_ORIGIN;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const g = screenToGrid({ x: x + 0.5, y: y + 0.5 }, o);
      if (g.gx >= 0 && g.gx < ROOM_TILES && g.gy >= 0 && g.gy < ROOM_TILES) {
        setPixel(buf, x, y, floorColor(g.gx, g.gy));
      }
    }
  }
  forEachWallPixel(({ side, u, v, x, y }) => {
    const c =
      v >= WALL_H - 2 || v < 2
        ? C.trim
        : walls === 'green_wallpaper'
          ? wallpaper(u, v, side === 'left' ? 1 : 0)
          : side === 'right'
            ? brick(u, v, C.brickR, C.mortarR)
            : brick(u, v, C.brickL, C.mortarL);
    setPixel(buf, x, y, c);
  });
  return buf;
}

/** A Persian rug lying flat in the middle of the floor (a shop item). */
export function rasterizeRug(): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const f = { gx: 2.6, gy: 4.0, w: 3.4, d: 2.0 };
  const red = hex('#8e2b2b');
  const cream = hex('#e8d8b0');
  const navy = hex('#2e3f6b');
  const gold = hex('#c9a227');
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const g = screenToGrid({ x: x + 0.5, y: y + 0.5 }, ROOM_ORIGIN);
      const a = g.gx - f.gx;
      const b = g.gy - f.gy;
      if (a < 0 || b < 0 || a >= f.w || b >= f.d) continue;
      const edge = Math.min(a, b, f.w - a, f.d - b);
      let c = red;
      if (edge < 0.12) c = gold;
      else if (edge < 0.3) c = navy;
      else if (Math.abs(a - f.w / 2) / (f.w / 2) + Math.abs(b - f.d / 2) / (f.d / 2) < 0.55) {
        c = Math.abs(a - f.w / 2) + Math.abs(b - f.d / 2) < 0.3 ? navy : cream;
      }
      setPixel(buf, x, y, c);
    }
  }
  return buf;
}

const DOLLAR = ['..x..', '.xxxx', 'x.x..', '.xxx.', '..x.x', 'xxxx.', '..x..'];

/** A neon "$" on the right wall, left of the window (a shop item). */
export function rasterizeNeonSign(lit: boolean): PixelBuffer {
  const board = hex('#2b1d16');
  const neon = lit ? hex('#ff4fa3') : hex('#7a3a5a');
  // Pink light bleeding onto the dark board around the tube.
  const glow = hex('#6b2a4a');
  const u0 = 1.0;
  const u1 = 2.6;
  const v0 = 24;
  const v1 = 38;
  return rasterizeWallLayer(({ side, u, v }) => {
    if (side !== 'right' || u < u0 || u >= u1 || v < v0 || v >= v1) return null;
    // Glyph pixel coordinates: 5 wide, 7 tall, centred on the board.
    const gx = Math.floor((u - u0) * 8) - 4;
    const gy = v1 - 1 - v - 3;
    const on = gy >= 0 && gy < DOLLAR.length && gx >= 0 && gx < 5 && DOLLAR[gy][gx] === 'x';
    if (on) return neon;
    const near =
      lit &&
      [-1, 0, 1].some((dy) =>
        [-1, 0, 1].some((dx) => DOLLAR[gy + dy]?.[gx + dx] === 'x' && gx + dx >= 0 && gx + dx < 5),
      );
    return near ? glow : board;
  });
}

// --- Window (right wall): shows the budget as weather ------------------------------

export const WINDOW = { u0: 3.5, u1: 6.5, v0: 16, v1: 40 };

const SKY: Record<Weather, { high: Rgba; low: Rgba; skyline: Rgba }> = {
  sunny: { high: hex('#8fc5e8'), low: hex('#b9dcef'), skyline: hex('#6d7f99') },
  cloudy: { high: hex('#a9b8c4'), low: hex('#c3cfd8'), skyline: hex('#6a7380') },
  rain: { high: hex('#7d8b99'), low: hex('#95a2ae'), skyline: hex('#4f5966') },
  storm: { high: hex('#3e4752'), low: hex('#535d69'), skyline: hex('#2c323a') },
};
const SUN = hex('#ffd85a');
const CLOUD = hex('#e6ebef');
const RAIN = hex('#c9d6e2');
const FLASH = hex('#eef3fb', 220);
const BOLT = hex('#fff6b0');

/** Frames of falling rain; sunny and cloudy have one frame. */
export const RAIN_FRAMES = 3;

export function inWindowGlass({ side, u, v }: WallPoint): boolean {
  const w = WINDOW;
  return side === 'right' && u >= w.u0 + 0.15 && u < w.u1 - 0.15 && v >= w.v0 + 2 && v < w.v1 - 2;
}

export function rasterizeWindow(weather: Weather, frame = 0): PixelBuffer {
  const w = WINDOW;
  const sky = SKY[weather];
  return rasterizeWallLayer((p) => {
    const { side, u, v, x, y } = p;
    if (side !== 'right' || u < w.u0 || u >= w.u1 || v < w.v0 || v >= w.v1) return null;
    if (!inWindowGlass(p)) return C.frame;
    if (Math.abs(u - (w.u0 + w.u1) / 2) < 0.08 || Math.abs(v - (w.v0 + w.v1) / 2) < 1) {
      return C.frame;
    }
    // Rain falls in screen space, slanting, and moves down each frame.
    if (weather === 'rain' || weather === 'storm') {
      const every = weather === 'storm' ? 5 : 7;
      if (x % 2 === 0 && (y - x + frame * 3 + 300) % every === 0) return RAIN;
    }
    const skylineTop = w.v0 + 3 + (Math.floor(u * 4) % 3) * 2;
    if (v < skylineTop) return sky.skyline;
    if (weather === 'sunny' && Math.hypot((u - 5.7) * 8, v - 33) < 3) return SUN;
    if (weather === 'cloudy') {
      const puff = (cu: number, cv: number, r: number) =>
        Math.hypot((u - cu) * 8, (v - cv) * 1.6) < r;
      if (puff(4.4, 32, 4) || puff(4.9, 33, 3.5) || puff(5.9, 29, 3)) return CLOUD;
    }
    return v < w.v0 + 12 ? sky.low : sky.high;
  });
}

/** Storm lightning: a pale wash over the glass with a bolt. */
export function rasterizeLightning(): PixelBuffer {
  return rasterizeWallLayer((p) => {
    if (!inWindowGlass(p)) return null;
    const boltU = 4.6 + (p.v % 6 < 3 ? 0.12 : 0) - (p.v - 18) * 0.012;
    if (p.v > 22 && Math.abs(p.u - boltU) < 0.1) return BOLT;
    return FLASH;
  });
}

// --- Piggy-bank poster (left wall): cracks when over budget -----------------------

export const POSTER = { u0: 1.6, u1: 3.4, v0: 16, v1: 34 };

export function inPoster({ side, u, v }: WallPoint): boolean {
  const p = POSTER;
  return side === 'left' && u >= p.u0 && u < p.u1 && v >= p.v0 && v < p.v1;
}

export function rasterizePoster(state: PosterState): PixelBuffer {
  const P = POSTER;
  const pig = hex('#e98fa8');
  const pigDark = hex('#b85f78');
  const paper = hex('#f3e6c8');
  const border = hex('#6b4a2e');
  const ink = hex('#3b2a1e');
  const coin = hex('#e2b13c');
  return rasterizeWallLayer((wp) => {
    if (!inPoster(wp)) return null;
    // Local poster pixels: px across (0..14), py up from the bottom.
    const px = (wp.u - P.u0) * 8;
    const py = wp.v - P.v0;
    const w = (P.u1 - P.u0) * 8;
    if (px < 1 || px >= w - 1 || py < 1 || py >= P.v1 - P.v0 - 1) return border;
    if (state === 'cracked') {
      const along = py * 0.8 + (Math.floor(py / 3) % 2 ? 1.2 : -1.2);
      if (Math.abs(px - along) < 0.7) return ink;
    }
    // Pig: body, snout, ear, legs and a coin dropping into the slot.
    const dx = (px - w / 2) / 6;
    const dy = (py - 8) / 4.5;
    if (Math.hypot(px - (w / 2 + 6), py - 8) < 1.8) return pigDark; // snout
    if (dx * dx + dy * dy < 1) {
      if (Math.abs(py - 12) < 0.6 && Math.abs(px - w / 2) < 2) return ink; // slot
      if (Math.abs(px - (w / 2 + 3)) < 0.6 && Math.abs(py - 9) < 0.6) return ink; // eye
      return pig;
    }
    if (
      py < 4 &&
      py >= 2 &&
      (Math.abs(px - (w / 2 - 3)) < 0.8 || Math.abs(px - (w / 2 + 3)) < 0.8)
    ) {
      return pigDark; // legs
    }
    if (Math.hypot(px - w / 2, py - 15) < 1.4) return coin;
    return paper;
  });
}

// --- Furniture -------------------------------------------------------------------

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

export type PropId = 'desk' | 'cabinet' | 'chair';

export type PropDef = {
  id: PropId;
  footprint: Footprint;
  heightPx: number;
  colors: BoxColors;
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
  },
  {
    id: 'chair',
    footprint: { gx: 3.9, gy: 0.9, w: 0.8, d: 0.5 },
    heightPx: 14,
    colors: {
      top: hex('#8e2b2b'),
      left: hex('#6e1f1f'),
      right: hex('#5a1919'),
      edge: hex('#a83a3a'),
    },
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
  },
];

export const propById = (id: PropId) => PROPS.find((p) => p.id === id)!;

/** Where Vinnie goes. All grid points on the floor. */
export const WAYPOINTS = {
  /** In front of the desk, where he reads receipts. */
  desk: { gx: 4.2, gy: 4 },
  /** Behind the desk, on the chair. */
  chair: { gx: 4.3, gy: 1.6 },
  window: { gx: 6.2, gy: 1.4 },
  espresso: { gx: 1.8, gy: 5.1 },
  plant: { gx: 1.6, gy: 2.6 },
  centre: { gx: 4, gy: 5.2 },
  /** Front corner, closest to the viewer: where he hits the glass. */
  camera: { gx: ROOM_TILES - 1, gy: ROOM_TILES - 1 },
} as const;

export type Waypoint = keyof typeof WAYPOINTS;
