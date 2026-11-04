// Vinnie, drawn in code: slicked dark hair, thick brows, moustache, white shirt with rolled
// sleeves, suspenders, crooked red tie, calculator watch. Every frame is the same figure in
// a different pose, so he stays himself. Final art can replace this sheet.

import {
  createBuffer,
  drawLine,
  fillRect,
  hex,
  packSheet,
  PixelBuffer,
  Rgba,
  setPixel,
} from '../pixels';

type Palette = {
  hair: Rgba;
  hairLight: Rgba;
  skin: Rgba;
  skinDark: Rgba;
  white: Rgba;
  eye: Rgba;
  dark: Rgba;
  shirt: Rgba;
  shirtDark: Rgba;
  tie: Rgba;
  tieDark: Rgba;
  strap: Rgba;
  watch: Rgba;
  trousers: Rgba;
  trousersDark: Rgba;
  shoe: Rgba;
  shoeLight: Rgba;
  buckle: Rgba;
  paper: Rgba;
  tape: Rgba;
};

const PALETTE: Palette = {
  hair: hex('#2b1d16'),
  hairLight: hex('#5a4030'),
  skin: hex('#e0a77a'),
  skinDark: hex('#b97c56'),
  white: hex('#fbf7ec'),
  eye: hex('#1a1210'),
  dark: hex('#151515'),
  shirt: hex('#f2efe6'),
  shirtDark: hex('#cfc8b8'),
  tie: hex('#b3262b'),
  tieDark: hex('#871b1f'),
  strap: hex('#4a2c1c'),
  watch: hex('#7fd36b'),
  trousers: hex('#2d2f3a'),
  trousersDark: hex('#1f2029'),
  shoe: hex('#1b1411'),
  shoeLight: hex('#4f3a2e'),
  buckle: hex('#d9b44a'),
  paper: hex('#ffffff'),
  tape: hex('#e8c547'),
};

export const VINNIE_W = 28;
export const VINNIE_H = 44;
/** Pixel offset of his feet (the point that stands on the grid) inside a frame. */
export const VINNIE_ANCHOR = { x: Math.floor(VINNIE_W / 2), y: VINNIE_H - 1 };

type Arm = { elbow: [number, number]; hand: [number, number] };

type Pose = {
  /** Screen-left and screen-right arms, in frame coordinates for the standing figure. */
  left?: Arm;
  right?: Arm;
  mouth?: boolean;
  brow?: 'flat' | 'raised';
  legs?: 'stand' | 'stepA' | 'stepB';
  /** Whole figure, positive is down. */
  dy?: number;
  /** Upper body only (breathing). */
  dip?: number;
  extras?: (b: PixelBuffer, p: Palette, dy: number) => void;
};

const LEFT_DOWN: Arm = { elbow: [5, 28], hand: [5, 34] };
const RIGHT_DOWN: Arm = { elbow: [22, 28], hand: [22, 34] };
const LEFT_UP: Arm = { elbow: [2, 16], hand: [2, 8] };
const RIGHT_UP: Arm = { elbow: [25, 16], hand: [25, 8] };
const LEFT_OUT: Arm = { elbow: [2, 24], hand: [0, 20] };
const RIGHT_OUT: Arm = { elbow: [25, 24], hand: [27, 20] };

function thick(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
  drawLine(b, x0, y0, x1, y1, c);
  drawLine(b, x0 + 1, y0, x1 + 1, y1, c);
  drawLine(b, x0, y0 + 1, x1, y1 + 1, c);
  drawLine(b, x0 + 1, y0 + 1, x1 + 1, y1 + 1, c);
}

function paintArm(
  b: PixelBuffer,
  p: Palette,
  shoulder: [number, number],
  arm: Arm,
  dy: number,
  watch: boolean,
): void {
  const [sx, sy] = shoulder;
  const [ex, ey] = arm.elbow;
  const [hx, hy] = arm.hand;
  thick(b, sx, sy + dy, ex, ey + dy, p.shirt);
  drawLine(b, sx + 1, sy + dy + 1, ex + 1, ey + dy + 1, p.shirtDark);
  thick(b, ex, ey + dy, hx, hy + dy, p.skin);
  // The rolled cuff, and his calculator watch on the left wrist.
  thick(b, ex, ey + dy, ex, ey + dy, p.shirtDark);
  if (watch) {
    const wx = Math.round(ex + (hx - ex) * 0.7);
    const wy = Math.round(ey + (hy - ey) * 0.7);
    fillRect(b, wx, wy + dy, 2, 2, p.watch);
  }
  // Fist.
  fillRect(b, hx - 1, hy + dy - 1, 4, 3, p.skin);
  fillRect(b, hx - 1, hy + dy + 1, 4, 1, p.skinDark);
}

function paintLegs(b: PixelBuffer, p: Palette, legs: Pose['legs'], dy: number): void {
  const leg = (x: number, top: number, bottom: number, forward: number) => {
    fillRect(b, x, top + dy, 5, 2, p.trousers);
    for (let y = top + 2; y <= bottom; y++) {
      const k = (y - top) / (bottom - top);
      const lx = x + Math.round(forward * k);
      fillRect(b, lx, y + dy, 5, 1, p.trousers);
      setPixel(b, lx + 4, y + dy, p.trousersDark);
      setPixel(b, lx + 2, y + dy, p.trousersDark);
    }
    const sx = x + forward;
    const toe = forward < 0 ? -2 : forward > 0 ? 2 : x < 14 ? -1 : 1;
    fillRect(b, sx + Math.min(0, toe), bottom + 1 + dy, 5 + Math.abs(toe), 2, p.shoe);
    fillRect(b, sx + 1, bottom + 1 + dy, 3, 1, p.shoeLight);
  };
  if (legs === 'stepA') {
    leg(8, 33, 40, -3);
    leg(15, 33, 39, 1);
  } else if (legs === 'stepB') {
    leg(8, 33, 39, -1);
    leg(15, 33, 40, 3);
  } else {
    leg(8, 33, 40, 0);
    leg(15, 33, 40, 0);
  }
}

function paintTorso(b: PixelBuffer, p: Palette, dy: number): void {
  // A stocky barrel, a little wider at the belly.
  for (let y = 19; y <= 31; y++) {
    const inset = y === 19 ? 1 : 0;
    fillRect(b, 7 + inset, y + dy, 14 - inset * 2, 1, p.shirt);
    setPixel(b, 20 - inset, y + dy, p.shirtDark);
  }
  fillRect(b, 19, 21 + dy, 1, 10, p.shirtDark);
  // Creases.
  setPixel(b, 11, 27 + dy, p.shirtDark);
  setPixel(b, 12, 28 + dy, p.shirtDark);
  setPixel(b, 16, 25 + dy, p.shirtDark);
  // Suspenders.
  fillRect(b, 9, 19 + dy, 2, 13, p.strap);
  fillRect(b, 17, 19 + dy, 2, 13, p.strap);
  // Crooked tie: knot, then it wanders off centre.
  fillRect(b, 13, 19 + dy, 3, 2, p.tieDark);
  fillRect(b, 13, 21 + dy, 3, 5, p.tie);
  fillRect(b, 14, 26 + dy, 3, 3, p.tie);
  fillRect(b, 15, 29 + dy, 2, 1, p.tie);
  setPixel(b, 15, 22 + dy, p.tieDark);
  setPixel(b, 15, 27 + dy, p.tieDark);
  // Collar.
  fillRect(b, 11, 18 + dy, 2, 2, p.white);
  fillRect(b, 15, 18 + dy, 2, 2, p.white);
  // Belt and buckle.
  fillRect(b, 7, 32 + dy, 14, 1, p.dark);
  fillRect(b, 13, 32 + dy, 2, 1, p.buckle);
}

function paintHead(b: PixelBuffer, p: Palette, pose: Pose, dy: number): void {
  const y = (n: number) => n + dy;
  // Neck.
  fillRect(b, 11, y(17), 6, 2, p.skinDark);
  // Ears.
  fillRect(b, 7, y(9), 1, 3, p.skinDark);
  fillRect(b, 20, y(9), 1, 3, p.skinDark);
  // Face.
  fillRect(b, 8, y(5), 12, 12, p.skin);
  fillRect(b, 9, y(16), 10, 1, p.skin);
  fillRect(b, 19, y(6), 1, 11, p.skinDark);
  fillRect(b, 10, y(16), 8, 1, p.skinDark);
  // Slicked-back hair, with a highlight running along it.
  fillRect(b, 9, y(2), 10, 1, p.hair);
  fillRect(b, 8, y(3), 12, 2, p.hair);
  fillRect(b, 8, y(5), 12, 1, p.hair);
  fillRect(b, 8, y(6), 2, 2, p.hair);
  fillRect(b, 18, y(6), 2, 2, p.hair);
  fillRect(b, 11, y(3), 5, 1, p.hairLight);
  setPixel(b, 16, y(4), p.hairLight);
  setPixel(b, 17, y(4), p.hairLight);
  // Brows: thick, and one goes up when he reads a receipt.
  fillRect(b, 9, y(8), 4, 1, p.hair);
  fillRect(b, 15, pose.brow === 'raised' ? y(7) : y(8), 4, 1, p.hair);
  // Eyes.
  fillRect(b, 10, y(9), 3, 2, p.white);
  fillRect(b, 15, y(9), 3, 2, p.white);
  fillRect(b, 11, y(9), 1, 2, p.eye);
  fillRect(b, 16, y(9), 1, 2, p.eye);
  // Nose.
  fillRect(b, 13, y(10), 2, 2, p.skinDark);
  // The moustache.
  fillRect(b, 10, y(12), 8, 2, p.hair);
  setPixel(b, 9, y(13), p.hair);
  setPixel(b, 18, y(13), p.hair);
  setPixel(b, 13, y(12), p.hairLight);
  // Mouth.
  if (pose.mouth) {
    fillRect(b, 12, y(14), 4, 2, p.dark);
    fillRect(b, 13, y(15), 2, 1, p.tie);
  }
}

function paintFrame(pose: Pose): PixelBuffer {
  const b = createBuffer(VINNIE_W, VINNIE_H);
  const p = PALETTE;
  const dy = pose.dy ?? 0;
  const upper = dy + (pose.dip ?? 0);
  paintLegs(b, p, pose.legs ?? 'stand', dy);
  paintTorso(b, p, upper);
  const left = pose.left ?? LEFT_DOWN;
  const right = pose.right ?? RIGHT_DOWN;
  paintArm(b, p, [5, 20], left, upper, true);
  paintArm(b, p, [21, 20], right, upper, false);
  paintHead(b, p, pose, upper);
  pose.extras?.(b, p, upper);
  return b;
}

const holdReceipt: Pose['extras'] = (b, p, dy) => {
  fillRect(b, 23, 1 + dy, 5, 7, p.paper);
  for (let y = 2; y < 7; y += 2) fillRect(b, 24, y + dy, 3, 1, p.shirtDark);
};
const inspectArm: Arm = { elbow: [25, 18], hand: [25, 9] };

const holdPhone: Pose['extras'] = (b, p, dy) => {
  fillRect(b, 5, 7 + dy, 3, 8, p.dark);
  fillRect(b, 4, 6 + dy, 3, 2, p.dark);
  fillRect(b, 4, 14 + dy, 3, 2, p.dark);
};
const phoneArm: Arm = { elbow: [2, 22], hand: [5, 13] };

const punchFist: Pose['extras'] = (b, p, dy) => {
  // Straight at the glass: the fist fills his chest.
  fillRect(b, 8, 19 + dy, 12, 9, p.skin);
  fillRect(b, 8, 26 + dy, 12, 2, p.skinDark);
  for (const x of [11, 14, 17]) fillRect(b, x, 19 + dy, 1, 4, p.skinDark);
};

const tapeAcross =
  (y: number): Pose['extras'] =>
  (b, p, dy) => {
    fillRect(b, 2, y + dy, 24, 3, p.tape);
    fillRect(b, 2, y + 2 + dy, 24, 1, p.buckle);
  };

/** Frames in sheet order. Animations index into this list. */
const FRAMES: PixelBuffer[] = [
  /* 0 */ paintFrame({}),
  /* 1 */ paintFrame({ dip: 1 }),
  /* 2 */ paintFrame({ legs: 'stepA' }),
  /* 3 */ paintFrame({ legs: 'stepB' }),
  /* 4 */ paintFrame({ dy: 6 }), // sitting: lower, legs hidden behind the desk
  /* 5 */ paintFrame({ right: inspectArm, extras: holdReceipt }),
  /* 6 */ paintFrame({ right: inspectArm, extras: holdReceipt, brow: 'raised' }),
  /* 7 */ paintFrame({ left: LEFT_UP, right: RIGHT_UP }),
  /* 8 */ paintFrame({ left: LEFT_UP, right: RIGHT_UP, mouth: true, dy: -2 }), // hop
  /* 9 */ paintFrame({ left: LEFT_OUT, right: RIGHT_OUT, mouth: true }),
  /* 10 */ paintFrame({ left: LEFT_OUT, right: RIGHT_OUT }),
  /* 11 */ paintFrame({ left: LEFT_UP, right: RIGHT_UP, mouth: true }),
  /* 12 */ paintFrame({ mouth: true, dy: 2, extras: punchFist }), // slam down
  /* 13 */ paintFrame({ left: phoneArm, extras: holdPhone }),
  /* 14 */ paintFrame({ left: phoneArm, extras: holdPhone, mouth: true }),
  /* 15 */ paintFrame({ right: { elbow: [26, 22], hand: [26, 14] }, mouth: true }), // wind up
  /* 16 */ paintFrame({ mouth: true, extras: punchFist }),
  /* 17 */ paintFrame({
    left: { elbow: [3, 28], hand: [2, 24] },
    right: { elbow: [25, 28], hand: [26, 24] },
    extras: tapeAcross(23),
  }),
  /* 18 */ paintFrame({
    left: { elbow: [2, 22], hand: [2, 16] },
    right: { elbow: [25, 22], hand: [26, 16] },
    extras: tapeAcross(15),
  }),
];

export type AnimName =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'inspect'
  | 'celebrate'
  | 'shout'
  | 'slam'
  | 'phone'
  | 'punch'
  | 'repair';

type Anim = { frames: number[]; ms: number; loop: boolean };

export const ANIMS: Record<AnimName, Anim> = {
  idle: { frames: [0, 0, 1, 1], ms: 220, loop: true },
  walk: { frames: [2, 0, 3, 0], ms: 130, loop: true },
  sit: { frames: [4], ms: 1000, loop: true },
  inspect: { frames: [5, 5, 6, 5], ms: 380, loop: true },
  celebrate: { frames: [7, 8], ms: 200, loop: true },
  shout: { frames: [9, 10], ms: 160, loop: true },
  slam: { frames: [11, 12, 12, 12], ms: 160, loop: false },
  phone: { frames: [13, 14], ms: 240, loop: true },
  punch: { frames: [15, 15, 16, 16, 16, 16], ms: 120, loop: false },
  repair: { frames: [17, 18], ms: 260, loop: true },
};

export const ANIM_NAMES = Object.keys(ANIMS) as AnimName[];

/** Outfits from the shop are colour swaps on the base palette. */
const OUTFITS: Record<string, [keyof Palette, Rgba][]> = {
  blue_tie: [
    ['tie', hex('#2f5fb3')],
    ['tieDark', hex('#234785')],
  ],
  sunday_vest: [
    ['strap', hex('#3d5a3a')],
    ['shirtDark', hex('#4f7350')],
    ['tie', hex('#c9a227')],
    ['tieDark', hex('#987a1c')],
  ],
};

function recolor(buf: PixelBuffer, from: Rgba, to: Rgba): void {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === from[0] && d[i + 1] === from[1] && d[i + 2] === from[2] && d[i + 3] > 0) {
      d[i] = to[0];
      d[i + 1] = to[1];
      d[i + 2] = to[2];
    }
  }
}

export function buildVinnieSheet(outfit?: string): PixelBuffer {
  const sheet = packSheet(FRAMES);
  for (const [key, to] of OUTFITS[outfit ?? ''] ?? []) recolor(sheet, PALETTE[key], to);
  return sheet;
}

/** Number of frames in the sheet (for tests and the sheet width). */
export const VINNIE_FRAME_COUNT = FRAMES.length;
