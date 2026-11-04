// The office shell, rasterised as pixel art: ground shadow, floor slab, planks, walls,
// and the layers painted on the walls (window, poster, neon). Furniture is in furniture.ts.

import type { PosterState, Weather } from '@/domain/roomState';

import { Footprint, Point, TILE_H, TILE_W } from './iso';
import {
  blendPixel,
  createBuffer,
  hex,
  mix,
  noise,
  PixelBuffer,
  Rgba,
  setPixel,
  shade,
} from './pixels';

export const ROOM_TILES = 8;
export const WALL_H = 96;
/** How thick the floor slab looks from the front. */
const SLAB_H = 8;
/** Room below the slab for the shadow it casts on the ground. */
const SHADOW_H = 22;
const MARGIN_X = 6;
const MARGIN_TOP = 6;
/** Wall thickness, in tiles. */
const WALL_T = 0.18;

export const ROOM_W = ROOM_TILES * TILE_W + MARGIN_X * 2;
export const ROOM_H = MARGIN_TOP + WALL_H + ROOM_TILES * TILE_H + SLAB_H + SHADOW_H;
/** Screen position of grid (0, 0), the back corner of the floor. */
export const ROOM_ORIGIN: Point = { x: ROOM_W / 2, y: MARGIN_TOP + WALL_H };

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
/** Art pixels along a wall per tile. */
export const WALL_PX_PER_TILE = HALF_W;

const C = {
  planks: [hex('#d8ae78'), hex('#cfa46e'), hex('#dfb682'), hex('#c79a63')],
  seam: hex('#a8794a'),
  bricksR: [hex('#b8432e'), hex('#a93c2a'), hex('#c44d34'), hex('#9c3626')],
  mortarR: hex('#e3cbb0'),
  bricksL: [hex('#8f3428'), hex('#842f25'), hex('#9a3a2c'), hex('#782a22')],
  mortarL: hex('#b89e8c'),
  crown: hex('#e9dcc2'),
  crownLight: hex('#fff6e0'),
  woodR: hex('#2f5f5a'),
  woodL: hex('#264e4b'),
  rail: hex('#e9dcc2'),
  base: hex('#1d2f2e'),
  cap: hex('#5a3a2a'),
  capDark: hex('#3f281c'),
  endL: hex('#5a2a20'),
  endR: hex('#6d3327'),
  slabL: hex('#4a4d57'),
  slabR: hex('#363842'),
  slabLip: hex('#6a6d78'),
  frame: hex('#ece4d2'),
  frameDark: hex('#b9ae98'),
};

const frac = (n: number) => n - Math.floor(n);
const pick = <T>(list: readonly T[], n: number) => list[Math.floor(n * list.length) % list.length];

// --- Floor -------------------------------------------------------------------------

const BOARD_LEN = 1.7;

function floorColor(gx: number, gy: number): Rgba {
  // Long boards running along gx, with staggered joints and a little grain.
  const row = Math.floor(gy * 3);
  if (frac(gy * 3) < 0.19) return C.seam;
  const along = gx / BOARD_LEN + noise(row, 11);
  if (frac(along) < 0.04) return C.seam;
  const board = Math.floor(along);
  let c = pick(C.planks, noise(board, row));
  if (noise(Math.floor(gx * 8) + board * 31, row * 5 + Math.floor(gy * 12)) > 0.86)
    c = shade(c, 0.93);
  // Dust and shadow gather along the walls.
  const d = Math.min(gx, gy);
  return d < 0.5 ? shade(c, 0.72 + 0.28 * (d / 0.5)) : c;
}

// --- Walls -------------------------------------------------------------------------

function brick(side: 'left' | 'right', u: number, v: number): Rgba {
  const mortar = side === 'right' ? C.mortarR : C.mortarL;
  if (v % 6 === 0) return mortar;
  const row = Math.floor(v / 6);
  const along = u * WALL_PX_PER_TILE + (row % 2) * 6;
  if (along % 12 < 1) return mortar;
  const n = noise(Math.floor(along / 12), row);
  const c = pick(side === 'right' ? C.bricksR : C.bricksL, n);
  // The odd pitted brick.
  return noise(Math.floor(along), v * 3) > 0.93 ? shade(c, 0.88) : c;
}

/** Striped green wallpaper (a shop item). */
function wallpaper(side: 'left' | 'right', u: number): Rgba {
  const stripe = Math.floor(u * 8) % 2 === 0;
  if (side === 'left') return stripe ? hex('#2f5a3d') : hex('#386b48');
  return stripe ? hex('#3c7350') : hex('#478559');
}

/** Dark wood up to the rail: panels with a lit top edge and a skirting board. */
function wainscot(side: 'left' | 'right', u: number, v: number): Rgba {
  if (v < 5) return v === 4 ? C.crownLight : C.base;
  if (v >= 25) return v === 27 ? shade(C.rail, 1.2) : C.rail;
  const wood = side === 'right' ? C.woodR : C.woodL;
  const px = u * WALL_PX_PER_TILE;
  const inPanel = px % 20;
  if (inPanel < 2 || v < 7 || v >= 23) return shade(wood, 1.12);
  if (inPanel < 3 || v === 7) return shade(wood, 0.72);
  return noise(Math.floor(px), Math.floor(v / 5)) > 0.9 ? shade(wood, 0.92) : wood;
}

/**
 * A point on a back wall: which wall, `u` in tiles from the corner along it, and
 * `v` in pixels up from the floor. x and y are the pixel's screen coordinates.
 */
export type WallPoint = { side: 'left' | 'right'; u: number; v: number; x: number; y: number };

type WallArea = { side: 'left' | 'right'; u0: number; u1: number };

/** Calls `fn` for every pixel on a back wall, or only those in `area`. */
function forEachWallPixel(fn: (p: WallPoint) => void, area?: WallArea): void {
  const o = ROOM_ORIGIN;
  for (let x = MARGIN_X; x < ROOM_W - MARGIN_X; x++) {
    const dx = x + 0.5 - o.x;
    const side = dx >= 0 ? 'right' : 'left';
    const u = Math.abs(dx) / HALF_W;
    if (area && (side !== area.side || u < area.u0 || u >= area.u1)) continue;
    const edgeY = o.y + Math.abs(dx) / 2;
    for (let y = Math.floor(edgeY - WALL_H) - 1; y < edgeY; y++) {
      const v = Math.floor(edgeY - (y + 0.5));
      if (v >= 0 && v < WALL_H) fn({ side, u, v, x, y });
    }
  }
}

/** A room-sized transparent layer painted onto the walls by `paint`. */
export function rasterizeWallLayer(
  paint: (p: WallPoint) => Rgba | null,
  area?: WallArea,
): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  forEachWallPixel((p) => {
    const c = paint(p);
    if (c) setPixel(buf, p.x, p.y, c);
  }, area);
  return buf;
}

export type WallStyle = 'brick' | 'green_wallpaper';

function wallColor(walls: WallStyle, { side, u, v }: WallPoint): Rgba {
  if (v >= WALL_H - 5)
    return v === WALL_H - 5 ? shade(C.crown, 0.7) : v === WALL_H - 3 ? C.crownLight : C.crown;
  if (v < 28) return wainscot(side, u, v);
  const c = walls === 'green_wallpaper' ? wallpaper(side, u) : brick(side, u, v);
  // Darker into the corner and just under the crown moulding, lighter toward the window.
  const corner = u < 0.5 ? 0.76 + 0.24 * (u / 0.5) : 1;
  const crown = v > WALL_H - 9 ? 0.86 : 1;
  const rail = v < 31 ? 0.88 : 1;
  return shade(c, corner * crown * rail);
}

/** The soft shadow the whole room casts on the ground, in stepped alpha. */
function paintGroundShadow(buf: PixelBuffer): void {
  const o = ROOM_ORIGIN;
  const halfRoom = ROOM_TILES * HALF_W;
  const bottom = o.y + ROOM_TILES * TILE_H + SLAB_H;
  for (let y = o.y; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      // Height of the slab's bottom edge above this pixel; the shadow falls away from it.
      const edge = bottom - Math.abs(x + 0.5 - o.x) / 2;
      const below = y + 0.5 - edge;
      if (below < -1 || below > SHADOW_H) continue;
      const side = 1 - Math.pow(Math.abs(x + 0.5 - o.x) / (halfRoom + MARGIN_X), 6);
      const a = 128 * Math.pow(1 - Math.max(0, below) / SHADOW_H, 1.5) * side;
      const stepped = Math.round(a / 8) * 8;
      if (stepped > 0) setPixel(buf, x, y, [58, 38, 24, stepped]);
    }
  }
}

/** The floor slab's two front faces, under the planks. */
function paintSlab(buf: PixelBuffer): void {
  const o = ROOM_ORIGIN;
  const n = ROOM_TILES;
  for (let x = 0; x < ROOM_W; x++) {
    const dx = x + 0.5 - o.x;
    if (Math.abs(dx) > n * HALF_W) continue;
    const top = o.y + n * TILE_H - Math.abs(dx) / 2;
    // Starts a little above the floor edge so no gap shows between the two.
    for (let i = -2; i < SLAB_H; i++) {
      const y = Math.floor(top) + i;
      const c = dx < 0 ? C.slabL : C.slabR;
      setPixel(buf, x, y, i <= 0 ? C.slabLip : i === SLAB_H - 1 ? shade(c, 0.8) : c);
    }
  }
}

/** The tops of the walls and their exposed ends, so they read as solid. */
function paintWallThickness(buf: PixelBuffer): void {
  const o = ROOM_ORIGIN;
  const n = ROOM_TILES;
  const t = WALL_T;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = x + 0.5 - o.x;
      const py = y + 0.5 - o.y;
      // Top of the wall, at wall height.
      const a = px / HALF_W;
      const b = (py + WALL_H) / HALF_H;
      const gx = (a + b) / 2;
      const gy = (b - a) / 2;
      const onLeft = gx >= -t && gx < 0 && gy >= -t && gy <= n;
      const onRight = gy >= -t && gy < 0 && gx >= -t && gx <= n;
      if (onLeft || onRight) {
        setPixel(buf, x, y, gx < -t / 2 && gy < -t / 2 ? C.capDark : C.cap);
        continue;
      }
      // The ends of the walls, seen from the front.
      for (const end of [
        { dx: px + n * HALF_W, sign: 1, c: C.endL },
        { dx: px - n * HALF_W, sign: -1, c: C.endR },
      ]) {
        // How far back along the thickness this column is, in tiles.
        const back = (-end.sign * end.dx) / HALF_W;
        if (back <= 0 || back > t) continue;
        const base = o.y + (n - back) * HALF_H;
        if (y + 0.5 < base + 1 && y + 0.5 >= base - WALL_H) setPixel(buf, x, y, end.c);
      }
    }
  }
}

export function rasterizeRoom(walls: WallStyle = 'brick'): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const o = ROOM_ORIGIN;
  paintGroundShadow(buf);
  paintSlab(buf);
  for (let y = o.y; y < o.y + ROOM_TILES * TILE_H; y++) {
    for (let x = MARGIN_X; x < ROOM_W - MARGIN_X; x++) {
      const a = (x + 0.5 - o.x) / HALF_W;
      const b = (y + 0.5 - o.y) / HALF_H;
      const gx = (a + b) / 2;
      const gy = (b - a) / 2;
      if (gx >= 0 && gx < ROOM_TILES && gy >= 0 && gy < ROOM_TILES) {
        setPixel(buf, x, y, floorColor(gx, gy));
      }
    }
  }
  forEachWallPixel((p) => setPixel(buf, p.x, p.y, wallColor(walls, p)));
  paintWallThickness(buf);
  return buf;
}

/** A Persian rug lying flat in the middle of the floor (a shop item). */
export function rasterizeRug(): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const f = { gx: 2.6, gy: 4.0, w: 3.4, d: 2.0 };
  const red = hex('#8e2b2b');
  const redDark = hex('#74211f');
  const cream = hex('#e8d8b0');
  const navy = hex('#2e3f6b');
  const gold = hex('#c9a227');
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = (x + 0.5 - ROOM_ORIGIN.x) / HALF_W;
      const py = (y + 0.5 - ROOM_ORIGIN.y) / HALF_H;
      const a = (px + py) / 2 - f.gx;
      const b = (py - px) / 2 - f.gy;
      if (a < 0 || b < 0 || a >= f.w || b >= f.d) continue;
      const edge = Math.min(a, b, f.w - a, f.d - b);
      let c = Math.floor(a * 6) % 2 === Math.floor(b * 6) % 2 ? red : redDark;
      if (edge < 0.06) c = cream;
      else if (edge < 0.14) c = gold;
      else if (edge < 0.3) c = Math.floor((a + b) * 6) % 2 === 0 ? navy : shade(navy, 1.25);
      else if (Math.abs(a - f.w / 2) / (f.w / 2) + Math.abs(b - f.d / 2) / (f.d / 2) < 0.55) {
        c = Math.abs(a - f.w / 2) + Math.abs(b - f.d / 2) < 0.3 ? navy : cream;
      }
      setPixel(buf, x, y, c);
    }
  }
  return buf;
}

const DOLLAR = ['..x..', '.xxxx', 'x.x..', '.xxx.', '..x.x', 'xxxx.', '..x..'];

/** Where the neon "$" hangs on the right wall, over the corkboard (a shop item). */
export const NEON = { u0: 0.7, u1: 2.45, v0: 46, v1: 82 };

export function rasterizeNeonSign(lit: boolean): PixelBuffer {
  const board = hex('#2b1d16');
  const frame = hex('#120c09');
  const neon = lit ? hex('#ff4fa3') : hex('#7a3a5a');
  const core = lit ? hex('#ffc2e0') : neon;
  // Pink light bleeding onto the dark board around the tube.
  const glow = hex('#6b2a4a');
  const cell = 3;
  const { u0, u1, v0, v1 } = NEON;
  const w = (u1 - u0) * WALL_PX_PER_TILE;
  const h = v1 - v0;
  const left = Math.floor((w - DOLLAR[0].length * cell) / 2);
  const top = Math.floor((h - DOLLAR.length * cell) / 2);
  const on = (gx: number, gy: number) => DOLLAR[gy]?.[gx] === 'x';
  return rasterizeWallLayer(
    ({ u, v }) => {
      if (v < v0 || v >= v1) return null;
      const px = Math.floor((u - u0) * WALL_PX_PER_TILE);
      const py = v1 - 1 - v;
      if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return frame;
      const cx = px - left;
      const cy = py - top;
      const gx = Math.floor(cx / cell);
      const gy = Math.floor(cy / cell);
      if (cx >= 0 && cy >= 0 && on(gx, gy)) {
        return cx % cell === 1 && cy % cell === 1 ? core : neon;
      }
      const near =
        lit &&
        [-1, 0, 1].some((dy) =>
          [-1, 0, 1].some((dx) => {
            const nx = Math.floor((cx + dx * 2) / cell);
            const ny = Math.floor((cy + dy * 2) / cell);
            return cx + dx * 2 >= 0 && cy + dy * 2 >= 0 && on(nx, ny);
          }),
        );
      return near ? glow : board;
    },
    { side: 'right', u0, u1 },
  );
}

// --- Window (right wall): the Brooklyn Bridge, and the budget as weather ----------

export const WINDOW = { u0: 3.2, u1: 6.8, v0: 32, v1: 88 };
/** Frame thickness in pixels. */
const WINDOW_FRAME = 3;

type Sky = { high: Rgba; low: Rgba; skyline: Rgba; lit: Rgba; water: Rgba; light: number };

const SKY: Record<Weather, Sky> = {
  sunny: {
    high: hex('#6fb3e6'),
    low: hex('#cfe7f4'),
    skyline: hex('#7f93ad'),
    lit: hex('#a3b5c9'),
    water: hex('#3f7ea6'),
    light: 1,
  },
  cloudy: {
    high: hex('#9fb0be'),
    low: hex('#d0d9df'),
    skyline: hex('#7b8693'),
    lit: hex('#9aa6b2'),
    water: hex('#5e7d92'),
    light: 0.88,
  },
  rain: {
    high: hex('#6e7c8a'),
    low: hex('#9aa6b1'),
    skyline: hex('#566170'),
    lit: hex('#d8c98a'),
    water: hex('#46596a'),
    light: 0.68,
  },
  storm: {
    high: hex('#2e3640'),
    low: hex('#555f6b'),
    skyline: hex('#2a3038'),
    lit: hex('#e8cf7a'),
    water: hex('#262f39'),
    light: 0.42,
  },
};
const SUN = hex('#ffe27a');
const SUN_HALO = hex('#fff0b8');
const CLOUD = hex('#eef2f5');
const CLOUD_DARK = hex('#c9d2da');
const RAIN = hex('#d3dfe9');
const FLASH = hex('#eef3fb', 220);
const BOLT = hex('#fff6b0');
const STONE = hex('#c8aa80');
const STONE_DARK = hex('#9d8360');
const STONE_LIGHT = hex('#e0c8a0');
const STEEL = hex('#3f4a57');
const STEEL_LIGHT = hex('#7d8894');
const DECK = hex('#544a40');

/** Frames of falling rain; sunny and cloudy have one frame. */
export const RAIN_FRAMES = 3;

export function inWindowGlass({ side, u, v }: WallPoint): boolean {
  const w = WINDOW;
  const edge = WINDOW_FRAME / WALL_PX_PER_TILE;
  return (
    side === 'right' &&
    u >= w.u0 + edge &&
    u < w.u1 - edge &&
    v >= w.v0 + WINDOW_FRAME &&
    v < w.v1 - WINDOW_FRAME
  );
}

// Bridge layout in glass pixels, from the bottom-left of the glass.
const DECK_T = 17;
const TOWER_X = 15;
const TOWER_HALF = 6;
const TOWER_TOP = 39;
const GLASS_W = (WINDOW.u1 - WINDOW.u0) * WALL_PX_PER_TILE - WINDOW_FRAME * 2;

/** Height of the main cable above the bottom of the glass at column s. */
function cableAt(s: number): number {
  if (s >= TOWER_X) {
    const k = (s - GLASS_W - 6) / (GLASS_W + 6 - TOWER_X);
    return DECK_T + 2 + (TOWER_TOP - 2 - DECK_T - 2) * k * k;
  }
  const k = (TOWER_X - s) / (TOWER_X + 12);
  return TOWER_TOP - 2 - (TOWER_TOP - 2 - DECK_T) * (2 * k - k * k);
}

/** What's in the glass at (s, t): sky, weather, Manhattan, the river and the bridge. */
function bridgeView(weather: Weather, s: number, t: number): Rgba {
  const sky = SKY[weather];
  const lit = (c: Rgba) => (sky.light === 1 ? c : mix(c, sky.skyline, 1 - sky.light));
  const col = Math.floor(s);

  // The tower stands in front of everything.
  const tx = s - TOWER_X;
  const ax = Math.abs(tx);
  if (t < 11 && ax < TOWER_HALF + 1) return lit(t >= 9 ? STONE_LIGHT : tx > 2 ? STONE_DARK : STONE);
  if (t < TOWER_TOP + 1) {
    const cornice = t >= TOWER_TOP - 3;
    if (ax < TOWER_HALF + (cornice ? 1 : 0) && t >= 11) {
      // Two pointed Gothic arches, with sky through them.
      const dist = Math.abs(ax - 2.9);
      const peak = 34 - dist * 2.4;
      const opening = t >= 19 && t < peak && dist < 1.9;
      if (!opening) {
        if (t === TOWER_TOP || t === TOWER_TOP - 3) return lit(STONE_LIGHT);
        if (t % 7 === 0 && !cornice) return lit(STONE_DARK);
        return lit(
          tx > TOWER_HALF - 2.5 ? STONE_DARK : tx < -TOWER_HALF + 1.5 ? STONE_LIGHT : STONE,
        );
      }
    }
  }

  // Roadway, with a pale rail on top.
  if (t >= DECK_T - 1 && t <= DECK_T + 1) {
    return lit(t === DECK_T + 1 ? STEEL_LIGHT : t === DECK_T ? DECK : shade(DECK, 0.75));
  }

  // Main cable, vertical suspenders and the bridge's diagonal stays.
  const cable = cableAt(s);
  if (Math.abs(t - cable) < 0.8) return lit(STEEL);
  if (t > DECK_T && t < cable) {
    if (col % 3 === 0) return lit(mix(STEEL_LIGHT, sky.low, 0.25));
    if (s > TOWER_X) {
      for (const reach of [14, 24, 34]) {
        const stay = TOWER_TOP - 3 - ((s - TOWER_X) * (TOWER_TOP - 3 - DECK_T)) / reach;
        if (s < TOWER_X + reach && Math.abs(t - stay) < 0.6) return lit(STEEL_LIGHT);
      }
    }
  }

  // The East River.
  if (t < 10) {
    const ripple = noise(Math.floor(s / 3) + t * 13, t);
    if (ripple > 0.84) return mix(sky.water, sky.low, 0.5);
    return t < 4 ? shade(sky.water, 0.88) : sky.water;
  }

  // Manhattan across the water: blocks of towers, a tall one, lit windows.
  const block = Math.floor(s / 4);
  const skyline = 15 + Math.floor(noise(block, 3) * 15);
  const spire = Math.abs(s - 42) < 2 ? 38 : Math.abs(s - 42) < 0.8 ? 44 : 0;
  const top = Math.max(skyline, spire);
  if (t < top) {
    if (col % 2 === 0 && t % 3 === 0 && noise(col, t) > 0.45) return sky.lit;
    return s % 4 < 1 ? shade(sky.skyline, 0.86) : sky.skyline;
  }

  // Weather in the sky.
  if (weather === 'sunny') {
    const d = Math.hypot(s - 43, t - 42);
    if (d < 3.5) return SUN;
    if (d < 5.5) return SUN_HALO;
  }
  if (weather === 'sunny' || weather === 'cloudy') {
    const puff = (cs: number, ct: number, r: number) => Math.hypot(s - cs, (t - ct) * 1.7) < r;
    const shapes =
      weather === 'sunny'
        ? [
            [28, 36, 4],
            [33, 37, 5],
            [37, 35, 3],
          ]
        : [
            [4, 40, 5],
            [9, 41, 6],
            [14, 45, 4],
            [28, 36, 6],
            [35, 38, 7],
            [43, 35, 5],
          ];
    if (shapes.some(([a, b, c]) => puff(a, b, c))) return CLOUD;
    if (shapes.some(([a, b, c]) => puff(a, b - 2, c))) return CLOUD_DARK;
  }
  const k = Math.min(1, Math.max(0, (t - 12) / 34));
  // Banded gradient, stepped so it stays pixel art.
  return mix(sky.low, sky.high, Math.floor(k * 7) / 7);
}

export function rasterizeWindow(weather: Weather, frame = 0): PixelBuffer {
  const w = WINDOW;
  const midU = (w.u0 + w.u1) / 2;
  return rasterizeWallLayer(
    (p) => {
      const { u, v, x, y } = p;
      if (v < w.v0 - 2 || v >= w.v1) return null;
      // A sill that juts out under the frame.
      if (v < w.v0) return v === w.v0 - 1 ? C.frame : C.frameDark;
      if (!inWindowGlass(p)) {
        return v >= w.v1 - 1 || u < w.u0 + 1 / WALL_PX_PER_TILE ? C.frameDark : C.frame;
      }
      const s = (u - w.u0) * WALL_PX_PER_TILE - WINDOW_FRAME;
      const t = v - w.v0 - WINDOW_FRAME;
      // Mullion, with a shadow on one side.
      const fromMid = (u - midU) * WALL_PX_PER_TILE;
      if (Math.abs(fromMid) < 1) return C.frame;
      if (fromMid >= 1 && fromMid < 2) return C.frameDark;
      // The glass top is shaded by a half-drawn blind.
      if (v >= w.v1 - WINDOW_FRAME - 5) {
        return (w.v1 - v) % 2 === 0 ? hex('#e6dcc4') : hex('#b5a98f');
      }
      // Rain falls in screen space, slanting, and moves down each frame.
      if (weather === 'rain' || weather === 'storm') {
        const every = weather === 'storm' ? 7 : 11;
        if (x % 3 === 0 && (y - x + frame * 4 + 600) % every < 2) return RAIN;
      }
      return bridgeView(weather, s, t);
    },
    { side: 'right', u0: w.u0, u1: w.u1 },
  );
}

/** Storm lightning: a pale wash over the glass with a bolt. */
export function rasterizeLightning(): PixelBuffer {
  const w = WINDOW;
  return rasterizeWallLayer(
    (p) => {
      if (!inWindowGlass(p)) return null;
      const boltU = w.u0 + 2.4 + (p.v % 10 < 5 ? 0.12 : 0) - (p.v - w.v0 - 10) * 0.012;
      if (p.v > w.v0 + 14 && Math.abs(p.u - boltU) < 0.06) return BOLT;
      return FLASH;
    },
    { side: 'right', u0: w.u0, u1: w.u1 },
  );
}

/** Daylight from the window lying on the floor; none in rain or storms. */
export function rasterizeSunPatch(weather: Weather): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  const alpha = weather === 'sunny' ? 72 : weather === 'cloudy' ? 30 : 0;
  if (!alpha) return buf;
  const warm: Rgba = [255, 248, 214, alpha];
  const f = { gx: 3.8, gy: 1.9, w: 3.2, d: 2.7 };
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = (x + 0.5 - ROOM_ORIGIN.x) / HALF_W;
      const py = (y + 0.5 - ROOM_ORIGIN.y) / HALF_H;
      const a = (px + py) / 2 - f.gx - ((py - px) / 2 - f.gy) * 0.5;
      const b = (py - px) / 2 - f.gy;
      if (a < 0 || b < 0 || a >= f.w || b >= f.d) continue;
      // Stays on the planks.
      const gx = (px + py) / 2;
      const gy = (py - px) / 2;
      if (gx >= ROOM_TILES || gy >= ROOM_TILES) continue;
      // The mullion's shadow runs down the middle.
      if (Math.abs(a - f.w / 2) < 0.07) continue;
      blendPixel(buf, x, y, warm);
    }
  }
  return buf;
}

// --- Espresso poster (left wall): cracks when over budget -------------------------

export const POSTER = { u0: 2.35, u1: 3.95, v0: 40, v1: 80 };

export function inPoster({ side, u, v }: WallPoint): boolean {
  const p = POSTER;
  return side === 'left' && u >= p.u0 && u < p.u1 && v >= p.v0 && v < p.v1;
}

const POSTER_TITLE = [
  'xxx.xxx.xxx.xxx.xxx',
  'x...x.x.x...x...x..',
  'x...xxx.xx..xx..xx.',
  'x...x.x.x...x...x..',
  'xxx.x.x.x...x...xxx',
];

export function rasterizePoster(state: PosterState): PixelBuffer {
  const P = POSTER;
  const frame = hex('#2b1d16');
  const frameLight = hex('#5a4030');
  const red = hex('#c8352c');
  const redDark = hex('#a82a24');
  const cream = hex('#f6ead0');
  const creamDark = hex('#d9c7a2');
  const coffee = hex('#3a2115');
  const green = hex('#2f8a55');
  const ink = hex('#1a1210');
  return rasterizeWallLayer(
    (wp) => {
      if (!inPoster(wp)) return null;
      // Poster pixels: px left to right on screen (u runs the other way on this wall),
      // py up from the bottom.
      const w = (P.u1 - P.u0) * WALL_PX_PER_TILE;
      const h = P.v1 - P.v0;
      const px = (P.u1 - wp.u) * WALL_PX_PER_TILE;
      const py = wp.v - P.v0;
      if (px < 2 || px >= w - 2 || py < 2 || py >= h - 2) {
        return py >= h - 1 || px >= w - 1 ? frameLight : frame;
      }
      if (state === 'cracked') {
        const along = py * 0.5 + (Math.floor(py / 5) % 2 ? 2 : -1);
        if (Math.abs(px - along) < 0.8) return ink;
      }
      // The Italian flag along the bottom.
      if (py < 7) return px < w / 3 ? green : px < (w * 2) / 3 ? cream : red;
      const cx = w / 2 - 1;
      // Title.
      const row = h - 5 - Math.ceil(py);
      const col = Math.floor(px) - 3;
      if (row >= 0 && row < POSTER_TITLE.length && POSTER_TITLE[row][col] === 'x') return cream;
      // Accent on the last letter.
      if (py >= h - 5 && py < h - 3 && col >= 17 && col < 19) return cream;
      // A cup and saucer.
      if (py >= 9 && py < 11 && Math.abs(px - cx) < 9 - (10.5 - py) * 2) {
        return py < 10 ? creamDark : cream;
      }
      if (py >= 11 && py < 19) {
        const half = 6.5 - Math.max(0, (14 - py) * 0.5);
        if (Math.abs(px - cx) < half) {
          if (py >= 18) return coffee;
          return px > cx + half - 2.5 ? creamDark : cream;
        }
        // Handle.
        const hd = Math.hypot(px - cx - 7, py - 15);
        if (hd >= 1.6 && hd < 3 && px > cx + 6) return cream;
      }
      // Steam.
      if (py >= 20 && py < 28) {
        for (const off of [-3, 2]) {
          const sx = cx + off + Math.sin((py + off) * 0.9) * 1.4;
          if (Math.abs(px - sx) < 0.8) return creamDark;
        }
      }
      // Sunburst behind it all.
      const angle = Math.atan2(py - 15, px - cx);
      return Math.floor((angle + Math.PI) * 5) % 2 === 0 ? red : redDark;
    },
    { side: 'left', u0: P.u0, u1: P.u1 },
  );
}

// --- Furniture primitive -----------------------------------------------------------

export type BoxColors = { top: Rgba; left: Rgba; right: Rgba; edge: Rgba };

export type BoxFace = 'top' | 'left' | 'right';

/**
 * Colours a pixel on a box. On the side faces `s` runs left to right on screen and `t`
 * up from the bottom, both in pixels, within a face `w` by `h`. On top, `s` runs along
 * gx and `t` along gy. Returning null keeps the box's flat colour.
 */
export type BoxDetail = (face: BoxFace, s: number, t: number, w: number, h: number) => Rgba | null;

/**
 * Paints an isometric box into `buf`. Faces get a lit top row and a darker bottom row,
 * and `lift` raises the whole box, so bigger things can be built out of several.
 */
export function paintBox(
  buf: PixelBuffer,
  f: Footprint,
  heightPx: number,
  colors: BoxColors,
  detail?: BoxDetail | null,
  lift = 0,
): void {
  const o = ROOM_ORIGIN;
  const xMin = Math.floor(o.x + (f.gx - f.gy - f.d) * HALF_W);
  const xMax = Math.ceil(o.x + (f.gx + f.w - f.gy) * HALF_W);
  const yMin = Math.floor(o.y + (f.gx + f.gy) * HALF_H - lift - heightPx);
  const yMax = Math.ceil(o.y + (f.gx + f.w + f.gy + f.d) * HALF_H - lift);
  const pxPerTile = HALF_W;
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const a = (px - o.x) / HALF_W;
      const b = (py + heightPx + lift - o.y) / HALF_H;
      const topGx = (a + b) / 2;
      const topGy = (b - a) / 2;
      if (topGx >= f.gx && topGx < f.gx + f.w && topGy >= f.gy && topGy < f.gy + f.d) {
        const c = detail?.(
          'top',
          Math.floor((topGx - f.gx) * pxPerTile),
          Math.floor((topGy - f.gy) * pxPerTile),
          f.w * pxPerTile,
          f.d * pxPerTile,
        );
        if (c) {
          setPixel(buf, x, y, c);
          continue;
        }
        const nearEdge =
          topGx - f.gx < 0.05 ||
          f.gx + f.w - topGx < 0.05 ||
          topGy - f.gy < 0.05 ||
          f.gy + f.d - topGy < 0.05;
        setPixel(buf, x, y, nearEdge ? colors.edge : colors.top);
        continue;
      }
      // Front-left face lies on the line gy = f.gy + f.d.
      const gyE = f.gy + f.d;
      const gxL = a + gyE;
      if (gxL >= f.gx && gxL <= f.gx + f.w) {
        const base = o.y + (gxL + gyE) * HALF_H - lift;
        if (py < base && py >= base - heightPx) {
          const s = Math.floor((gxL - f.gx) * pxPerTile);
          const t = Math.floor(base - py);
          const c = detail?.('left', s, t, f.w * pxPerTile, heightPx) ?? colors.left;
          setPixel(buf, x, y, t >= heightPx - 1 ? shade(c, 1.14) : t === 0 ? shade(c, 0.8) : c);
          continue;
        }
      }
      // Front-right face lies on the line gx = f.gx + f.w.
      const gxE = f.gx + f.w;
      const gyR = gxE - a;
      if (gyR >= f.gy && gyR <= f.gy + f.d) {
        const base = o.y + (gxE + gyR) * HALF_H - lift;
        if (py < base && py >= base - heightPx) {
          const s = Math.floor((f.gy + f.d - gyR) * pxPerTile);
          const t = Math.floor(base - py);
          const c = detail?.('right', s, t, f.d * pxPerTile, heightPx) ?? colors.right;
          setPixel(buf, x, y, t >= heightPx - 1 ? shade(c, 1.14) : t === 0 ? shade(c, 0.8) : c);
        }
      }
    }
  }
}

/** An isometric box standing on the floor in a room-sized buffer, for depth-sorted layers. */
export function rasterizeBox(
  f: Footprint,
  heightPx: number,
  colors: BoxColors,
  detail?: BoxDetail,
): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  paintBox(buf, f, heightPx, colors, detail);
  return buf;
}

export type PropId = 'desk' | 'cabinet' | 'chair' | 'visitor';

export type PropDef = {
  id: PropId;
  footprint: Footprint;
  heightPx: number;
  colors: BoxColors;
};

/** Furniture that Vinnie walks around, sorted against him. Drawn in furniture.ts. */
export const PROPS: readonly PropDef[] = [
  {
    id: 'cabinet',
    footprint: { gx: 0.1, gy: 4.2, w: 0.85, d: 1.5 },
    heightPx: 34,
    colors: {
      top: hex('#a0683f'),
      left: hex('#6e4226'),
      right: hex('#7f4e2d'),
      edge: hex('#bd8452'),
    },
  },
  {
    id: 'chair',
    footprint: { gx: 3.9, gy: 0.9, w: 0.8, d: 0.6 },
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
    heightPx: 24,
    colors: {
      top: hex('#74371f'),
      left: hex('#4f2414'),
      right: hex('#3f1c10'),
      edge: hex('#94502f'),
    },
  },
  {
    id: 'visitor',
    footprint: { gx: 5.55, gy: 3.9, w: 0.62, d: 0.62 },
    heightPx: 12,
    colors: {
      top: hex('#a0683f'),
      left: hex('#6e4226'),
      right: hex('#5a3520'),
      edge: hex('#bd8452'),
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
