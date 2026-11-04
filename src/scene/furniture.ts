// What makes it an office: everything in the room besides the shell. Things that stand
// against the walls are baked into the room image, which keeps the live sprite count low;
// the desk, chairs and credenza stay separate so Vinnie can walk behind them.

import { Footprint, gridToScreen, TILE_H, TILE_W } from './iso';
import {
  blendPixel,
  createBuffer,
  fillRect,
  hex,
  noise,
  PixelBuffer,
  Rgba,
  setPixel,
  shade,
} from './pixels';
import {
  BoxColors,
  BoxDetail,
  NEON,
  paintBox,
  PropId,
  propById,
  rasterizeRoom,
  rasterizeWallLayer,
  ROOM_H,
  ROOM_ORIGIN,
  ROOM_W,
  WALL_PX_PER_TILE,
  WallPoint,
  WallStyle,
} from './room';

const box = (top: string, left: string, right: string, edge = top): BoxColors => ({
  top: hex(top),
  left: hex(left),
  right: hex(right),
  edge: hex(edge),
});

const WALNUT = box('#a0683f', '#6e4226', '#7f4e2d', '#bd8452');
const DARK_WOOD = box('#7c4a2a', '#4f2d19', '#5e3620', '#94603a');
const STEEL_GREEN = box('#8d9b7a', '#5e6b4c', '#6d7b58', '#a9b694');
const IRON = box('#3c3f45', '#232529', '#2d3036', '#55585f');
const LEATHER = box('#8e2b2b', '#6e1f1f', '#5a1919', '#a83a3a');
const PAPER = box('#f4eedd', '#cfc6ae', '#dcd3bc', '#fffaf0');
const CARD = box('#c9a877', '#9a7c50', '#ad8d5f', '#d9bd8f');
const BRASS = hex('#d9b44a');
const BRASS_DARK = hex('#8f6f24');
const INK = hex('#2b1d16');

const BOOK_COLORS = [
  '#7a2e2e',
  '#2f4a6b',
  '#3b6b4a',
  '#8a6a2e',
  '#5a3a6b',
  '#2b2b33',
  '#a85c32',
].map((c) => hex(c));

/** Rows of mismatched spines on `shelfH`-pixel shelves, inside a wood frame. */
function shelves(wood: Rgba, shelfH: number, seed: number): BoxDetail {
  return (face, s, t, w, h) => {
    if (face === 'top') return null;
    if (s < 2 || s >= w - 2 || t < 3 || t >= h - 2) return wood;
    const row = Math.floor((t - 3) / shelfH);
    const inRow = (t - 3) % shelfH;
    if (inRow < 2) return inRow === 0 ? shade(wood, 1.15) : wood;
    // Book boundaries vary by shelf, and some gaps show the dark back of the case.
    const unit = Math.floor((s + row * 3) / 3);
    const n = noise(unit + seed, row * 7);
    const tall = shelfH - 3 - Math.floor(noise(unit, row + seed) * 4);
    if (n > 0.9 || inRow - 2 >= tall) return shade(wood, 0.42);
    const c = BOOK_COLORS[Math.floor(n * BOOK_COLORS.length) % BOOK_COLORS.length];
    if ((s + row * 3) % 3 === 2) return shade(c, 0.7);
    return inRow - 2 === tall - 3 ? shade(c, 1.4) : c;
  };
}

/** Drawers: grooves, a label holder and a pull on each. */
function drawers(rows: number, columns: number): BoxDetail {
  return (face, s, t, w, h) => {
    if (face === 'top') return null;
    const base = face === 'right' ? STEEL_GREEN.right : STEEL_GREEN.left;
    const dh = (h - 2) / rows;
    const dw = w / columns;
    const ds = s % dw;
    const dt = (t - 2) % dh;
    if (t < 2) return shade(base, 0.6);
    if (ds < 1 || dt < 1) return shade(base, 0.66);
    if (ds < 2 || dt >= dh - 1) return shade(base, 1.12);
    const mid = dw / 2;
    if (Math.abs(ds - mid) < 3 && dt >= dh - 5 && dt < dh - 3) return hex('#f4eedd');
    if (Math.abs(ds - mid) < 2 && dt >= dh - 9 && dt < dh - 7) return hex('#d8dcdf');
    return null;
  };
}

function shadowFloor(buf: PixelBuffer, f: Footprint): void {
  // A soft dark rim on the floor, thicker toward the viewer.
  const grow = 0.16;
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const px = (x + 0.5 - ROOM_ORIGIN.x) / halfW;
      const py = (y + 0.5 - ROOM_ORIGIN.y) / halfH;
      const gx = (px + py) / 2;
      const gy = (py - px) / 2;
      if (gx < 0 || gy < 0 || gx >= 8 || gy >= 8) continue;
      const dx = Math.max(f.gx - gx, gx - f.gx - f.w, 0);
      const dy = Math.max(f.gy - gy, gy - f.gy - f.d, 0);
      const d = Math.max(dx, dy);
      if (d > grow) continue;
      blendPixel(buf, x, y, [30, 16, 8, d < grow / 2 ? 110 : 60]);
    }
  }
}

// --- On the walls ------------------------------------------------------------------

const CPA = ['xxx.xxx.xxx', 'x...x.x.x.x', 'x...xxx.xxx', 'x...x...x.x', 'xxx.x...x.x'];

/** Everything flat on the walls, in wall pixels (px across, py up). */
function wallDecor({ side, u, v }: WallPoint): Rgba | null {
  const at = u * WALL_PX_PER_TILE;
  if (side === 'left') {
    // Mother's photo, in a heavy frame, above the espresso machine.
    if (at >= 73 && at < 91 && v >= 60 && v < 84) {
      const px = at - 73;
      const py = v - 60;
      if (px < 2 || px >= 16 || py < 2 || py >= 22)
        return py >= 22 ? hex('#a87f3e') : hex('#7d5a28');
      // Sepia: dark hair framing a stern face, a black dress with a white collar.
      const face = Math.hypot(px - 9, py - 12);
      if (face < 3.4) {
        if (Math.abs(py - 13) < 0.8 && Math.abs(Math.abs(px - 9) - 1.5) < 0.7)
          return hex('#2e2219');
        return hex('#d9bd97');
      }
      if (Math.hypot(px - 9, py - 13) < 5) return hex('#2e2219');
      if (py < 7.5) return Math.abs(px - 9) < 2 && py > 6 ? hex('#f4eedd') : hex('#3a2b22');
      return hex('#cdb68f');
    }
    // A frosted-glass office door, near the front.
    if (at >= 105 && at < 126 && v < 82) {
      const px = at - 105;
      if (px < 2 || px >= 19 || v >= 80) return px >= 19 ? hex('#172726') : hex('#1f3a38');
      if (v < 4) return hex('#172726');
      if (v < 38) {
        if (px >= 15 && px < 17 && v >= 34 && v < 37) return BRASS;
        if (px >= 4 && px < 15 && (v === 10 || v === 28)) return hex('#172726');
        return px < 3 || px >= 16 ? hex('#264e4b') : hex('#2f5f5a');
      }
      if (v < 40 || v >= 76) return hex('#264e4b');
      if (px < 4 || px >= 17) return hex('#264e4b');
      // Frosted glass, with the name in black: the letters read from inside, like his books.
      const row = 72 - v;
      const col = 16 - Math.floor(px);
      if (row >= 0 && row < CPA.length && CPA[row][col] === 'x') return INK;
      if (v === 60 && col >= 1 && col < 10) return INK;
      return noise(Math.floor(px), v) > 0.8 ? hex('#cfe1e0') : hex('#dceaea');
    }
    return null;
  }
  // Right wall. A corkboard of receipts and red string, sometimes under the neon sign.
  const cork = NEON;
  const cu0 = cork.u0 * WALL_PX_PER_TILE;
  const cu1 = cork.u1 * WALL_PX_PER_TILE;
  if (at >= cu0 && at < cu1 && v >= cork.v0 && v < cork.v1) {
    const px = at - cu0;
    const py = v - cork.v0;
    const w = cu1 - cu0;
    const h = cork.v1 - cork.v0;
    if (px < 2 || px >= w - 2 || py < 2 || py >= h - 2) return hex('#5a3520');
    // String from pin to pin.
    const pins = [
      [6, 28],
      [18, 26],
      [12, 14],
      [22, 9],
    ];
    for (let i = 1; i < pins.length; i++) {
      const [x0, y0] = pins[i - 1];
      const [x1, y1] = pins[i];
      const k = (px - x0) / (x1 - x0);
      if (k >= 0 && k <= 1 && Math.abs(py - (y0 + (y1 - y0) * k)) < 0.7) return hex('#c92b2b');
    }
    for (const [x, y] of pins) if (Math.hypot(px - x, py - y) < 1.2) return BRASS;
    for (const [x, y, pw, ph] of [
      [3, 23, 7, 9],
      [14, 20, 8, 10],
      [8, 7, 7, 10],
      [18, 4, 7, 8],
    ]) {
      if (px >= x && px < x + pw && py >= y && py < y + ph) {
        return Math.floor(py) % 2 === 0 && px > x + 1 && px < x + pw - 1
          ? hex('#a9a290')
          : hex('#f4eedd');
      }
    }
    return noise(Math.floor(px), Math.floor(py)) > 0.7 ? hex('#a97f50') : hex('#bd9060');
  }
  // A wall clock. It only ever shows the time the taxes are due.
  const clock = Math.hypot(at - 45, v - 76);
  if (clock < 6) {
    if (clock >= 5) return hex('#3a2115');
    if (Math.abs(at - 45) < 0.7 && v >= 76 && v < 80) return INK;
    if (v >= 75.3 && v < 76.7 && at >= 45 && at < 48) return INK;
    if (clock >= 3.8 && (Math.abs(at - 45) < 0.7 || Math.abs(v - 75.5) < 1)) return hex('#7a6a5a');
    return hex('#f4eedd');
  }
  // His CPA licence, framed, under the clock.
  if (at >= 40 && at < 50 && v >= 50 && v < 64) {
    const px = at - 40;
    const py = v - 50;
    if (px < 1 || px >= 9 || py < 1 || py >= 13) return hex('#2b1d16');
    if (py < 4 && px > 5 && px < 8) return BRASS;
    if (py >= 10 && px > 1 && px < 8) return INK;
    if (py % 2 === 0 && px > 1 && px < 8) return hex('#a9a290');
    return hex('#f4eedd');
  }
  // A calendar past the window. Every Sunday's circled.
  if (at >= 112 && at < 124 && v >= 72 && v < 90) {
    const px = at - 112;
    const py = v - 72;
    if (py >= 13) return py >= 17 ? hex('#7a1f1f') : hex('#c4302b');
    if (Math.floor(px) % 2 === 1 && py % 3 === 1) return px < 2 ? hex('#c4302b') : hex('#7a7468');
    return hex('#f4eedd');
  }
  return null;
}

// --- Against the walls -------------------------------------------------------------

function paintCoatRack(buf: PixelBuffer): void {
  const foot = gridToScreen({ gx: 7.5, gy: 0.4 }, ROOM_ORIGIN);
  const x = Math.round(foot.x);
  const y = Math.round(foot.y);
  const wood = hex('#4f2d19');
  const light = hex('#7c4a2a');
  fillRect(buf, x - 6, y - 1, 13, 2, wood);
  fillRect(buf, x - 3, y - 2, 7, 1, light);
  fillRect(buf, x, y - 70, 1, 69, light);
  fillRect(buf, x + 1, y - 70, 1, 69, wood);
  for (const [dx, dy] of [
    [-3, -66],
    [3, -66],
    [-3, -60],
    [3, -60],
  ]) {
    fillRect(buf, x + dx, y + dy, 3, 1, wood);
  }
  // A trench coat...
  const coat = hex('#a58a5f');
  const coatDark = hex('#7c6642');
  for (let i = 0; i < 34; i++) {
    const w = 8 + Math.floor(i / 8);
    fillRect(buf, x - 3 - w + 4, y - 60 + i, w, 1, i % 11 === 0 ? coatDark : coat);
    setPixel(buf, x - 3 - w + 4, y - 60 + i, coatDark);
  }
  fillRect(buf, x - 3, y - 61, 3, 2, coatDark);
  // ...and a fedora.
  const hat = hex('#2f2a26');
  fillRect(buf, x - 3, y - 76, 10, 6, hat);
  fillRect(buf, x - 5, y - 71, 14, 2, shade(hat, 1.3));
  fillRect(buf, x - 3, y - 73, 10, 1, hex('#7a1f1f'));
  setPixel(buf, x + 1, y - 76, shade(hat, 0.7));
  setPixel(buf, x + 2, y - 76, shade(hat, 0.7));
}

function paintBakedFurniture(buf: PixelBuffer): void {
  const place = (
    f: Footprint,
    h: number,
    colors: BoxColors,
    detail?: BoxDetail | null,
    lift = 0,
  ) => {
    if (lift === 0) shadowFloor(buf, f);
    paintBox(buf, f, h, colors, detail, lift);
  };

  // Tall ledger case in the back corner.
  place({ gx: 0.08, gy: 0.2, w: 0.55, d: 1.2 }, 82, DARK_WOOD, shelves(DARK_WOOD.right, 15, 3));

  // Low shelf of binders under the corkboard.
  place({ gx: 0.75, gy: 0.06, w: 1.85, d: 0.5 }, 28, WALNUT, shelves(WALNUT.left, 12, 9));
  place({ gx: 0.95, gy: 0.14, w: 0.5, d: 0.34 }, 6, PAPER, null, 28);
  place({ gx: 1, gy: 0.16, w: 0.42, d: 0.3 }, 3, box('#2f4a6b', '#1f3350', '#27405f'), null, 34);

  // Green steel filing cabinets, under the poster.
  place({ gx: 0.08, gy: 2.4, w: 0.6, d: 1.55 }, 36, STEEL_GREEN, drawers(2, 2));
  place({ gx: 0.16, gy: 2.6, w: 0.42, d: 0.5 }, 5, CARD, null, 36);
  place({ gx: 0.2, gy: 3.3, w: 0.36, d: 0.42 }, 3, PAPER, null, 36);

  paintCredenza(buf);

  // The old safe. Nobody asks what's in it.
  place({ gx: 0.1, gy: 5.85, w: 0.8, d: 0.72 }, 30, IRON, (face, s, t, w, h) => {
    if (face !== 'right') return null;
    if (s < 2 || s >= w - 2 || t < 3 || t >= h - 2) return shade(IRON.right, 0.72);
    const cx = w / 2;
    const cy = h / 2;
    const d = Math.hypot(s - cx, t - cy);
    if (d < 1.5) return hex('#2b2b2b');
    if (d < 4.5) return s % 2 === 0 ? BRASS : BRASS_DARK;
    if (s === Math.floor(w - 4) && t > h - 10 && t < h - 4) return hex('#8a8d94');
    return null;
  });

  // Radiator under the window.
  place(
    { gx: 3.5, gy: 0.06, w: 3, d: 0.3 },
    22,
    box('#d9d2bf', '#a8a08c', '#8d8674', '#efe8d6'),
    (face, s, t) => {
      if (face !== 'left') return null;
      if (t < 3) return hex('#5a5346');
      return s % 4 === 0 ? hex('#7b7463') : s % 4 === 1 ? hex('#efe8d6') : null;
    },
  );

  // Banker's boxes by the coat rack, one marked for a year he doesn't discuss.
  const boxLabel: BoxDetail = (face, s, t, w, h) => {
    if (face !== 'left') return null;
    if (Math.abs(s - w / 2) < 5 && Math.abs(t - h / 2) < 3) {
      return t === Math.floor(h / 2) && s % 2 === 0 ? INK : hex('#f4eedd');
    }
    return null;
  };
  paintCoatRack(buf);
  place({ gx: 6.6, gy: 0.42, w: 0.8, d: 0.55 }, 13, CARD, boxLabel);
  place({ gx: 6.66, gy: 0.46, w: 0.68, d: 0.48 }, 12, CARD, boxLabel, 13);
}

/** The whole room with what's fixed in it, ready to go behind the sprites. */
export function rasterizeOffice(walls: WallStyle = 'brick'): PixelBuffer {
  const buf = rasterizeRoom(walls);
  const decor = rasterizeWallLayer(wallDecor);
  for (let i = 0; i < buf.data.length; i += 4) {
    if (decor.data[i + 3] === 0) continue;
    buf.data.set(decor.data.subarray(i, i + 4), i);
  }
  for (const id of ['desk', 'cabinet', 'chair', 'visitor'] as const) {
    shadowFloor(buf, propById(id).footprint);
  }
  paintBakedFurniture(buf);
  return buf;
}

// --- Furniture Vinnie walks around ------------------------------------------------

function paintDesk(buf: PixelBuffer): void {
  const f = propById('desk').footprint;
  const { heightPx: h, colors } = propById('desk');
  const body = { gx: f.gx + 0.06, gy: f.gy + 0.06, w: f.w - 0.12, d: f.d - 0.12 };
  const slab = 3;
  // Two drawer pedestals with a dark knee space between, facing the visitor.
  paintBox(buf, body, h - slab, colors, (face, s, t, w, ph) => {
    if (face === 'top') return null;
    const wood = face === 'right' ? colors.right : colors.left;
    if (face === 'right') {
      // The side: a framed panel.
      if (s < 2 || s >= w - 2 || t < 2 || t >= ph - 2) return shade(wood, 1.15);
      return s % 7 === 0 ? shade(wood, 0.92) : wood;
    }
    const ped = w * 0.3;
    if (s >= ped && s < w - ped) {
      // Modesty panel, lit along its top.
      if (t >= ph - 2) return shade(wood, 1.1);
      return t < 3 ? shade(wood, 0.5) : shade(wood, 0.62);
    }
    const inPed = s < ped ? s : s - (w - ped);
    if (inPed < 1 || inPed >= ped - 1) return shade(wood, 0.7);
    const dh = (ph - 2) / 3;
    const dt = (t - 2) % dh;
    if (t < 2) return shade(wood, 0.55);
    if (dt < 1) return shade(wood, 0.66);
    if (dt >= dh - 1) return shade(wood, 1.16);
    if (Math.abs(inPed - ped / 2) < 2.2 && Math.abs(dt - dh / 2) < 0.9) return BRASS;
    return null;
  });
  // Top, with a green leather blotter and a brass-edged lip.
  paintBox(
    buf,
    f,
    slab,
    colors,
    (face, s, t, w, d) => {
      if (face !== 'top') return null;
      const bx = Math.abs(s - w / 2);
      const by = Math.abs(t - d / 2);
      if (bx < 15 && by < 7) return bx >= 14 || by >= 6 ? hex('#d9c17a') : hex('#2f6a4a');
      return noise(s, Math.floor(t / 3)) > 0.8 ? hex('#663019') : null;
    },
    h - slab,
  );
  const top = h;
  // Ledgers, stacked at one end.
  const ledger = (dy: number, c: string) =>
    paintBox(
      buf,
      { gx: f.gx + 2, gy: f.gy + 0.72, w: 0.48, d: 0.36 },
      2,
      box(c, shade2(c), shade2(c, 0.65)),
      (face, s, t) => (face !== 'top' && t === 0 && s > 1 ? hex('#f4eedd') : null),
      top + dy,
    );
  ledger(0, '#2f4a6b');
  ledger(2, '#7a2e2e');
  ledger(4, '#3b6b4a');
  // An adding machine with a paper tape curling out of it.
  paintBox(
    buf,
    { gx: f.gx + 0.1, gy: f.gy + 0.7, w: 0.46, d: 0.36 },
    6,
    box('#5d6470', '#3b414c', '#4a515d', '#7b838f'),
    (face, s, t) => (face === 'top' && s % 3 === 1 && t % 3 === 1 ? hex('#efe8d6') : null),
    top,
  );
  paintBox(buf, { gx: f.gx + 0.22, gy: f.gy + 0.72, w: 0.16, d: 0.08 }, 6, PAPER, null, top + 6);
  // Papers awaiting his attention, a mug, and the nameplate on the front edge.
  paintBox(
    buf,
    { gx: f.gx + 1.2, gy: f.gy + 0.76, w: 0.42, d: 0.32 },
    1,
    PAPER,
    (face, s, t) => (face === 'top' && t % 2 === 0 && s > 1 && s < 11 ? hex('#a9a290') : null),
    top,
  );
  paintBox(
    buf,
    { gx: f.gx + 0.72, gy: f.gy + 0.14, w: 0.17, d: 0.17 },
    5,
    box('#3a2115', '#e8e0cc', '#c9c0aa', '#f4eedd'),
    null,
    top,
  );
  paintBox(
    buf,
    { gx: f.gx + 0.95, gy: f.gy + 0.98, w: 0.6, d: 0.1 },
    4,
    box('#c9a227', '#8f6f24', '#6f561c'),
    (face, s, t, w) =>
      face === 'left' && t > 0 && t < 3 && s > 1 && s < w - 1 && s % 2 === 0
        ? hex('#fff0b8')
        : null,
    top,
  );
}

const shade2 = (c: string, k = 0.8) => {
  const [r, g, b] = shade(hex(c), k);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};

function paintExecutiveChair(buf: PixelBuffer): void {
  const f = propById('chair').footprint;
  // Five-star base and a column.
  const cx = f.gx + f.w / 2;
  const cy = f.gy + f.d / 2;
  paintBox(buf, { gx: cx - 0.34, gy: cy - 0.08, w: 0.68, d: 0.16 }, 2, IRON);
  paintBox(buf, { gx: cx - 0.08, gy: cy - 0.28, w: 0.16, d: 0.56 }, 2, IRON);
  paintBox(buf, { gx: cx - 0.05, gy: cy - 0.05, w: 0.1, d: 0.1 }, 9, IRON, null, 2);
  // High tufted back, against the window side.
  const tufted: BoxDetail = (face, s, t, w, h) => {
    if (face !== 'left') return null;
    if (s < 2 || s >= w - 2 || t >= h - 2 || t < 1) return hex('#a83a3a');
    const on = (s + (Math.floor(t / 6) % 2) * 4) % 8 === 4 && t % 6 === 3;
    return on ? hex('#d9b44a') : (s + t) % 8 === 0 ? hex('#7c2424') : hex('#8e2b2b');
  };
  paintBox(buf, { gx: f.gx, gy: f.gy, w: f.w, d: 0.14 }, 34, LEATHER, tufted, 10);
  // Seat and arms.
  paintBox(buf, { gx: f.gx, gy: f.gy + 0.1, w: f.w, d: f.d - 0.1 }, 5, LEATHER, null, 9);
  paintBox(
    buf,
    { gx: f.gx - 0.04, gy: f.gy + 0.12, w: 0.1, d: f.d - 0.16 },
    2,
    DARK_WOOD,
    null,
    18,
  );
  paintBox(
    buf,
    { gx: f.gx + f.w - 0.06, gy: f.gy + 0.12, w: 0.1, d: f.d - 0.16 },
    2,
    DARK_WOOD,
    null,
    18,
  );
}

function paintVisitorChair(buf: PixelBuffer): void {
  const f = propById('visitor').footprint;
  const leg = 0.09;
  const legs: [number, number][] = [
    [f.gx, f.gy],
    [f.gx + f.w - leg, f.gy],
    [f.gx, f.gy + f.d - leg],
    [f.gx + f.w - leg, f.gy + f.d - leg],
  ];
  for (const [gx, gy] of legs) paintBox(buf, { gx, gy, w: leg, d: leg }, 11, DARK_WOOD);
  // Seat, then a slatted back on the side away from the desk. You don't get comfortable here.
  paintBox(buf, f, 2, WALNUT, null, 11);
  const back = f.gy + f.d - 0.07;
  for (const k of [0, 0.3, 0.6, 0.9]) {
    paintBox(
      buf,
      { gx: f.gx + (f.w - 0.07) * k, gy: back, w: 0.07, d: 0.07 },
      12,
      DARK_WOOD,
      null,
      13,
    );
  }
  paintBox(buf, { gx: f.gx, gy: back, w: f.w, d: 0.07 }, 4, WALNUT, null, 25);
}

function paintCredenza(buf: PixelBuffer): void {
  const { footprint: f, heightPx: h, colors } = propById('cabinet');
  paintBox(buf, f, h, colors, (face, s, t, w, ph) => {
    if (face === 'top') return noise(s, Math.floor(t / 3)) > 0.82 ? hex('#8e5833') : null;
    const wood = face === 'right' ? colors.right : colors.left;
    if (t < 3) return shade(wood, 0.55);
    if (face !== 'right') return s < 2 || s >= w - 2 ? shade(wood, 1.12) : null;
    // Two cupboard doors with raised panels and brass pulls.
    const door = s % (w / 2);
    const dw = w / 2;
    if (door < 1) return shade(wood, 0.62);
    if (door < 3 || door >= dw - 2 || t < 6 || t >= ph - 3) return shade(wood, 1.14);
    if (door < 4 || t === 6) return shade(wood, 0.74);
    if (Math.abs(door - (dw - 5)) < 1 && Math.abs(t - ph / 2) < 3) return BRASS;
    return null;
  });
}

const PAINTERS: Record<PropId, (buf: PixelBuffer) => void> = {
  desk: paintDesk,
  cabinet: paintCredenza,
  chair: paintExecutiveChair,
  visitor: paintVisitorChair,
};

/** One piece of furniture in a room-sized layer. */
export function rasterizeFurniture(id: PropId): PixelBuffer {
  const buf = createBuffer(ROOM_W, ROOM_H);
  PAINTERS[id](buf);
  return buf;
}
