// Prop sprites, drawn in code. States are separate sprites so the scene can swap them.

import { rng } from '@/domain/random';
import { PlantState } from '@/domain/roomState';

import {
  blit,
  createBuffer,
  packSheet,
  fillRect,
  hex,
  PixelBuffer,
  Rgba,
  setPixel,
  shade,
  spriteFromRows,
} from '../pixels';

// --- The ficus --------------------------------------------------------------------

export const PLANT_W = 36;
export const PLANT_H = 64;

type Foliage = {
  count: number;
  /** Leaf colours, dark to light. */
  leaves: Rgba[];
  /** How far leaves hang below their branch. */
  droop: number;
};

const FOLIAGE: Record<PlantState, Foliage | null> = {
  healthy: {
    count: 90,
    leaves: [hex('#2f6a33'), hex('#3f8a42'), hex('#5fae4f'), hex('#8fd16a')],
    droop: 0,
  },
  droopy: {
    count: 54,
    leaves: [hex('#5f7a2c'), hex('#7a9636'), hex('#9db84a'), hex('#b9cd64')],
    droop: 3,
  },
  wilted: {
    count: 26,
    leaves: [hex('#6d5a26'), hex('#8d7732'), hex('#b39a4a'), hex('#c9b264')],
    droop: 6,
  },
  dead: null,
};

const BRANCHES: [number, number, number, number][] = [
  [18, 44, 18, 20],
  [18, 34, 9, 24],
  [18, 30, 27, 20],
  [18, 26, 11, 13],
  [18, 22, 24, 10],
];

export function buildPlant(state: PlantState): PixelBuffer {
  const b = createBuffer(PLANT_W, PLANT_H);
  const trunk = state === 'dead' ? hex('#5a3f28') : hex('#6b4a2e');
  for (const [x0, y0, x1, y1] of BRANCHES) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      setPixel(b, x, y, trunk);
      if (i < steps / 2) setPixel(b, x + 1, y, shade(trunk, 0.8));
    }
  }
  const foliage = FOLIAGE[state];
  if (foliage) {
    const rand = rng(11);
    const crowns = [
      [9, 22, 8],
      [27, 18, 8],
      [11, 11, 8],
      [24, 9, 8],
      [18, 15, 9],
    ];
    for (let i = 0; i < foliage.count; i++) {
      const [cx, cy, r] = crowns[i % crowns.length];
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * r;
      const x = Math.round(cx + Math.cos(angle) * dist);
      const y = Math.round(cy + Math.sin(angle) * dist * 0.8 + foliage.droop * rand());
      // Lit from the top: later, higher leaves are the bright ones.
      const lightness = 1 - (y + 4) / 34 + rand() * 0.45 - 0.2;
      const shadeAt = Math.max(0, Math.min(3, Math.floor(lightness * 4)));
      const c = foliage.leaves[shadeAt];
      fillRect(b, x, y, 3, 2, c);
      setPixel(b, x + (rand() > 0.5 ? 3 : -1), y + (foliage.droop ? 1 : 0), shade(c, 0.85));
    }
  } else {
    // Dead: a few dry leaves left on the floor of the pot.
    for (const [x, y] of [
      [12, 46],
      [24, 46],
      [20, 47],
    ]) {
      fillRect(b, x, y, 2, 1, hex('#8d7732'));
    }
  }
  // Terracotta pot with a rim and soil.
  const pot = hex('#b5653a');
  const potDark = hex('#8a4a28');
  const potLight = hex('#d4845a');
  for (let y = 50; y < PLANT_H; y++) {
    const inset = Math.floor((y - 50) / 5);
    fillRect(b, 10 + inset, y, 16 - inset * 2, 1, pot);
    setPixel(b, 10 + inset, y, potLight);
    setPixel(b, 11 + inset, y, potLight);
    fillRect(b, 22 - inset, y, 4 - inset, 1, potDark);
    setPixel(b, 25 - inset, y, potDark);
  }
  fillRect(b, 9, 47, 18, 3, pot);
  fillRect(b, 9, 47, 18, 1, potLight);
  fillRect(b, 23, 48, 4, 2, potDark);
  fillRect(b, 11, 47, 14, 1, hex('#3f2a1c'));
  return b;
}

// --- Wastebasket and the receipt pile -------------------------------------------

export const PILE_W = 48;
export const PILE_H = 28;

function buildBin(): PixelBuffer {
  const b = createBuffer(14, 14);
  const mesh = hex('#7a7a7a');
  const meshDark = hex('#4a4a4a');
  fillRect(b, 0, 0, 14, 2, hex('#a8a8a8'));
  fillRect(b, 0, 1, 14, 1, meshDark);
  for (let y = 2; y < 14; y++) {
    const inset = y >= 11 ? 2 : 1;
    for (let x = inset; x < 14 - inset; x++) {
      const on = (x + y) % 3 === 0 || (x - y + 30) % 3 === 0;
      if (on) setPixel(b, x, y, x > 10 ? meshDark : mesh);
    }
    setPixel(b, inset, y, meshDark);
    setPixel(b, 13 - inset, y, meshDark);
  }
  fillRect(b, 2, 13, 10, 1, meshDark);
  return b;
}

const BALL = spriteFromRows(['..qq..', '.qqQq.', 'qQqqqQ', 'qqqQqq', '.QqqQ.'], {
  q: hex('#fffdf6'),
  Q: hex('#d9d4c7'),
});

/** Bin's top-left inside the pile sprite. */
const BIN_AT = { x: 32, y: 14 };
/** Where each crumpled receipt lands, in order: on top of the bin, then the floor. */
const BALL_SPOTS = [
  [33, 10],
  [39, 10],
  [35, 6],
  [40, 4],
  [24, 22],
  [18, 22],
  [12, 22],
  [20, 18],
  [26, 18],
  [14, 18],
  [6, 22],
  [22, 14],
  [16, 14],
  [10, 18],
] as const;

export function buildReceiptPile(count: number): PixelBuffer {
  const buf = createBuffer(PILE_W, PILE_H);
  blit(buf, buildBin(), BIN_AT.x, BIN_AT.y);
  // Floor balls go behind the bin's front edge only if they overlap; draw bin-top ones last.
  const spots = BALL_SPOTS.slice(0, Math.min(count, BALL_SPOTS.length));
  for (const [x, y] of spots.slice(4)) blit(buf, BALL, x, y);
  for (const [x, y] of spots.slice(0, 4)) blit(buf, BALL, x, y);
  return buf;
}

// --- Luc the cat ----------------------------------------------------------------

const CAT = {
  fur: hex('#d98a3a'),
  dark: hex('#a8622a'),
  light: hex('#f0b566'),
  white: hex('#f5e9d6'),
  eye: hex('#2b2b2b'),
  nose: hex('#e08a8a'),
};

function sleepingCat(tail: number): PixelBuffer {
  const b = createBuffer(20, 11);
  // Curled loaf with stripes.
  fillRect(b, 4, 3, 13, 7, CAT.fur);
  fillRect(b, 3, 5, 15, 4, CAT.fur);
  fillRect(b, 5, 3, 11, 1, CAT.light);
  for (const x of [8, 11, 14]) fillRect(b, x, 3, 1, 4, CAT.dark);
  fillRect(b, 3, 9, 15, 1, CAT.dark);
  // Head tucked down at the front, eyes shut.
  fillRect(b, 1, 4, 7, 6, CAT.fur);
  setPixel(b, 1, 3, CAT.fur);
  setPixel(b, 2, 2, CAT.dark);
  setPixel(b, 6, 3, CAT.fur);
  setPixel(b, 6, 2, CAT.dark);
  fillRect(b, 2, 6, 2, 1, CAT.eye);
  fillRect(b, 5, 6, 2, 1, CAT.eye);
  setPixel(b, 4, 7, CAT.nose);
  fillRect(b, 3, 8, 3, 1, CAT.white);
  // Tail curling round the front, flicking between frames.
  fillRect(b, 15, 9 - tail, 4, 1, CAT.dark);
  setPixel(b, 18, 8 - tail, CAT.fur);
  return b;
}

function sittingCat(tailUp: number): PixelBuffer {
  const b = createBuffer(16, 20);
  // Ears, head.
  setPixel(b, 2, 0, CAT.dark);
  fillRect(b, 2, 1, 2, 1, CAT.fur);
  setPixel(b, 9, 0, CAT.dark);
  fillRect(b, 8, 1, 2, 1, CAT.fur);
  fillRect(b, 1, 2, 10, 7, CAT.fur);
  fillRect(b, 2, 2, 8, 1, CAT.light);
  fillRect(b, 4, 2, 1, 2, CAT.dark);
  fillRect(b, 7, 2, 1, 2, CAT.dark);
  // That look.
  fillRect(b, 3, 5, 2, 2, hex('#b8d65a'));
  fillRect(b, 7, 5, 2, 2, hex('#b8d65a'));
  setPixel(b, 4, 5, CAT.eye);
  setPixel(b, 4, 6, CAT.eye);
  setPixel(b, 7, 5, CAT.eye);
  setPixel(b, 7, 6, CAT.eye);
  setPixel(b, 5, 7, CAT.nose);
  setPixel(b, 6, 7, CAT.nose);
  fillRect(b, 4, 8, 4, 1, CAT.white);
  // Body, chest, paws.
  fillRect(b, 2, 9, 8, 9, CAT.fur);
  fillRect(b, 4, 10, 4, 6, CAT.white);
  fillRect(b, 9, 10, 1, 8, CAT.dark);
  for (const y of [11, 14]) fillRect(b, 2, y, 2, 1, CAT.dark);
  fillRect(b, 2, 18, 3, 2, CAT.white);
  fillRect(b, 7, 18, 3, 2, CAT.white);
  fillRect(b, 2, 19, 8, 1, CAT.dark);
  // Tail.
  fillRect(b, 10, 18, 3, 1, CAT.fur);
  fillRect(b, 12, 15 - tailUp, 2, 4 + tailUp, CAT.fur);
  fillRect(b, 13, 15 - tailUp, 1, 2, CAT.dark);
  return b;
}

export const CAT_SLEEPING = [sleepingCat(0), sleepingCat(1)];
export const CAT_SITTING = [sittingCat(0), sittingCat(2)];

export const CAT_RUN_W = 24;
export const CAT_RUN_H = 14;
export const CAT_RUN_FRAMES = 4;

/** Luc at full tilt, heading right, ears back. */
function runningCat(frame: number): PixelBuffer {
  const b = createBuffer(CAT_RUN_W, CAT_RUN_H);
  const bob = frame % 2;
  // Body, stripes.
  fillRect(b, 6, 4 + bob, 12, 5, CAT.fur);
  fillRect(b, 6, 4 + bob, 12, 1, CAT.light);
  fillRect(b, 6, 8 + bob, 12, 1, CAT.dark);
  for (const x of [9, 12, 15]) fillRect(b, x, 4 + bob, 1, 3, CAT.dark);
  // Head, ears flat, wide eye.
  fillRect(b, 17, 3 + bob, 6, 5, CAT.fur);
  fillRect(b, 17, 2 + bob, 2, 1, CAT.dark);
  fillRect(b, 20, 4 + bob, 2, 2, hex('#b8d65a'));
  setPixel(b, 21, 5 + bob, CAT.eye);
  setPixel(b, 23, 6 + bob, CAT.nose);
  fillRect(b, 19, 7 + bob, 3, 1, CAT.white);
  // Tail straight out, then legs in a gallop.
  fillRect(b, 1, 3 + bob, 5, 1, CAT.dark);
  fillRect(b, 0, 2 + bob, 2, 1, CAT.fur);
  const spread = [4, 1, -2, 1][frame];
  for (const [x, dir] of [
    [8, -1],
    [15, 1],
  ]) {
    const foot = x + dir * spread;
    for (let i = 0; i < 4; i++) {
      const lx = Math.round(x + ((foot - x) * i) / 3);
      fillRect(b, lx, 9 + bob + i, 2, 1, CAT.fur);
    }
    fillRect(b, foot, 12 + bob, 2, 1, CAT.white);
  }
  return b;
}
export const CAT_RUN_SHEET = packSheet(
  Array.from({ length: CAT_RUN_FRAMES }, (_, i) => runningCat(i)),
);

// --- Desk and credenza top items ---------------------------------------------------

function buildPhone(): PixelBuffer {
  const b = createBuffer(16, 12);
  const body = hex('#1f1f1f');
  const light = hex('#4a4a4a');
  // Handset on its cradle.
  fillRect(b, 1, 0, 14, 2, body);
  fillRect(b, 2, 0, 12, 1, light);
  fillRect(b, 0, 1, 3, 2, body);
  fillRect(b, 13, 1, 3, 2, body);
  fillRect(b, 6, 2, 4, 2, body);
  // Body, and the rotary dial.
  fillRect(b, 2, 4, 12, 7, body);
  fillRect(b, 1, 9, 14, 3, body);
  fillRect(b, 2, 4, 12, 1, light);
  const cx = 7.5;
  const cy = 7;
  for (let y = 4; y < 11; y++) {
    for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy);
      if (d < 3.6) setPixel(b, x, y, d < 1.5 ? hex('#c4302b') : hex('#e8e8e8'));
      if (d >= 2 && d < 3 && (x + y) % 2 === 0) setPixel(b, x, y, body);
    }
  }
  return b;
}
export const PHONE = buildPhone();

function buildLamp(): PixelBuffer {
  // A banker's lamp: green glass shade, brass stem and base.
  const b = createBuffer(16, 20);
  const brass = hex('#c9a227');
  const brassDark = hex('#8f6f24');
  const glass = hex('#2f7a4a');
  const glassLight = hex('#58b878');
  fillRect(b, 7, 0, 2, 1, brass);
  fillRect(b, 2, 1, 12, 2, glass);
  fillRect(b, 1, 3, 14, 3, glass);
  fillRect(b, 3, 1, 8, 1, glassLight);
  fillRect(b, 2, 3, 6, 1, glassLight);
  fillRect(b, 1, 5, 14, 1, shade(glass, 0.7));
  fillRect(b, 2, 6, 12, 1, hex('#fff0b8'));
  fillRect(b, 7, 7, 2, 9, brass);
  fillRect(b, 8, 7, 1, 9, brassDark);
  fillRect(b, 4, 16, 8, 2, brass);
  fillRect(b, 3, 18, 10, 2, brass);
  fillRect(b, 3, 19, 10, 1, brassDark);
  fillRect(b, 10, 8, 1, 4, hex('#d9d2bf'));
  return b;
}
export const LAMP = buildLamp();

function buildEspresso(body: Rgba, bodyDark: Rgba, accent: Rgba): PixelBuffer {
  // A proper lever machine: dome, boiler, group head, drip tray and a cup.
  const b = createBuffer(20, 26);
  const chrome = hex('#d9dde3');
  const chromeDark = hex('#8f959e');
  const handle = hex('#1f1f1f');
  // Levers, standing up off the group.
  fillRect(b, 3, 0, 2, 5, handle);
  fillRect(b, 4, 4, 1, 6, chromeDark);
  // Dome.
  fillRect(b, 7, 1, 6, 1, chromeDark);
  fillRect(b, 5, 2, 10, 2, chrome);
  fillRect(b, 7, 2, 3, 1, hex('#ffffff'));
  // Boiler.
  fillRect(b, 2, 4, 16, 9, body);
  fillRect(b, 2, 4, 16, 1, shade(body, 1.3));
  fillRect(b, 15, 5, 3, 8, bodyDark);
  fillRect(b, 2, 12, 16, 1, chromeDark);
  // Gauge and a badge.
  fillRect(b, 4, 6, 4, 4, chrome);
  fillRect(b, 5, 7, 2, 2, hex('#1f1f1f'));
  setPixel(b, 6, 7, accent);
  fillRect(b, 10, 7, 4, 2, accent);
  // Group head and portafilter.
  fillRect(b, 7, 13, 6, 2, chromeDark);
  fillRect(b, 6, 15, 8, 1, handle);
  fillRect(b, 13, 15, 5, 1, handle);
  // Column, tray and a small white cup.
  fillRect(b, 16, 13, 2, 10, body);
  fillRect(b, 2, 13, 2, 10, body);
  fillRect(b, 8, 19, 4, 4, hex('#fbf7ec'));
  fillRect(b, 12, 20, 1, 2, hex('#cfc8b8'));
  fillRect(b, 1, 23, 18, 2, chrome);
  fillRect(b, 1, 25, 18, 1, chromeDark);
  for (let x = 3; x < 17; x += 2) setPixel(b, x, 23, chromeDark);
  return b;
}

export const ESPRESSO = buildEspresso(hex('#a9503a'), hex('#7a3626'), hex('#d64541'));

function steam(phase: number): PixelBuffer {
  const b = createBuffer(10, 14);
  const white = hex('#ffffff', 170);
  const faint = hex('#ffffff', 90);
  for (let y = 0; y < 14; y++) {
    const x = Math.round(5 + Math.sin(y * 0.7 + phase * 2.1) * 2.4);
    setPixel(b, x, y, y < 5 ? faint : white);
    if (y > 8) setPixel(b, x + 1, y, faint);
  }
  return b;
}
export const STEAM_FRAMES = [steam(0), steam(1), steam(2)];

// --- Shop items -------------------------------------------------------------------

function buildCatBed(): PixelBuffer {
  const b = createBuffer(26, 12);
  const rim = hex('#6b3d7a');
  const inner = hex('#c99ad6');
  const light = hex('#e6c6ee');
  for (let y = 0; y < 12; y++) {
    const half = 13 - Math.abs(y - 6) * 1.1;
    for (let x = 0; x < 26; x++) {
      const dx = Math.abs(x + 0.5 - 13);
      if (dx > half) continue;
      const lip = dx > half - 3 || y >= 9 || y < 2;
      setPixel(b, x, y, lip ? (y >= 9 ? shade(rim, 0.8) : rim) : y === 4 ? light : inner);
    }
  }
  return b;
}
export const CAT_BED = buildCatBed();

export const DELUXE_ESPRESSO = buildEspresso(hex('#b3262b'), hex('#7d1a1e'), hex('#e8c547'));
