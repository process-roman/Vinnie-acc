// Placeholder Vinnie: slicked dark hair, moustache, white shirt with rolled
// sleeves, suspenders, crooked red tie, calculator watch. Every pose is the base
// sprite with some rows replaced. Final art replaces this sheet.

import { createBuffer, hex, packSheet, PixelBuffer, spriteFromRows } from '../pixels';

const PALETTE = {
  h: hex('#2b1d16'), // hair, brows, moustache
  s: hex('#e0a77a'), // skin
  d: hex('#b97c56'), // skin shadow
  e: hex('#1a1210'), // eyes
  k: hex('#151515'), // shoes, open mouth, phone
  w: hex('#f2efe6'), // shirt
  g: hex('#cfc8b8'), // shirt shadow
  r: hex('#b3262b'), // tie
  b: hex('#4a2c1c'), // suspenders
  c: hex('#7fd36b'), // calculator watch
  p: hex('#2d2f3a'), // trousers
  q: hex('#ffffff'), // receipt paper
  y: hex('#e8c547'), // tape
};

const BASE = [
  '...hhhhhh...', // 0
  '..hhhhhhhh..', // 1
  '..hhssssshh.', // 2
  '..hshhsshhs.', // 3
  '..ssesssess.', // 4
  '..sssddssss.', // 5
  '..shhhhhhss.', // 6
  '...ssssss...', // 7
  '....dddd....', // 8
  '..wwwrrwww..', // 9
  '.wbwwrrwwbw.', // 10
  '.wbwwrrwwbg.', // 11
  '.wbwwwrwwbg.', // 12
  'swbwwwrwwbgs', // 13
  'scbwwwwwwbgs', // 14
  '..pppppppp..', // 15
  '..pppppppp..', // 16
  '..ppp..ppp..', // 17
  '..ppp..ppp..', // 18
  '..ppp..ppp..', // 19
  '.kkkk..kkkk.', // 20
] as const;

export const VINNIE_W = BASE[0].length;
export const VINNIE_H = BASE.length;
/** Pixel offset of his feet (the point that stands on the grid) inside a frame. */
export const VINNIE_ANCHOR = { x: Math.floor(VINNIE_W / 2), y: VINNIE_H - 1 };
/** Rows above this belong to the upper body, which bobs when breathing. */
const LEGS_START = 15;

const MOUTH_OPEN = '...sskkss...';

const UPPER = {
  armsUp: {
    7: 's..ssssss..s',
    8: 's...dddd...s',
    9: 'swwwwrrwwwws',
    10: '..bwwrrwwb..',
    11: '..bwwrrwwb..',
    12: '..bwwwrwwb..',
    13: '..bwwwrwwb..',
    14: '..bwwwwwwb..',
  },
  armsOut: {
    9: '..wwwrrwww..',
    10: 'swwwwrrwwwws',
    11: '..bwwrrwwb..',
    12: '..bwwwrwwb..',
    13: '..bwwwrwwb..',
    14: '..bwwwwwwb..',
  },
  // Right arm up, holding a receipt to the light.
  inspect: {
    1: '..hhhhhhhhqq',
    2: '..hhssssshqq',
    3: '..hshhsshhqq',
    4: '..ssesssesss',
    5: '..sssddssssw',
    6: '..shhhhhhssw',
    7: '...ssssss.w.',
    8: '....dddd.w..',
    10: '.wbwwrrwwb..',
    11: '.wbwwrrwwb..',
    12: '.wbwwwrwwb..',
    13: 'swbwwwrwwb..',
    14: 'scbwwwwwwb..',
  },
  // Left hand holding the receiver to his ear.
  phone: {
    4: '.kssesssess.',
    5: '.ksssddssss.',
    6: '.sshhhhhhss.',
    7: '.w.ssssss...',
    8: '.w..dddd....',
    9: '.wwwwrrwww..',
    10: '..bwwrrwwbw.',
    11: '..bwwrrwwbg.',
    12: '..bwwwrwwbg.',
    13: '..bwwwrwwbgs',
    14: '..bwwwwwwbgs',
  },
  // Right arm cocked back.
  windUp: {
    5: '..sssddsssss',
    6: '..shhhhhhssw',
    7: '...ssssss.w.',
    8: '....dddd.w..',
    10: '.wbwwrrwwb..',
    11: '.wbwwrrwwb..',
    12: '.wbwwwrwwb..',
    13: 'swbwwwrwwb..',
    14: 'scbwwwwwwb..',
  },
  // Fist coming straight at the glass.
  punch: {
    9: '..wsssssww..',
    10: '.wbssssssbw.',
    11: '.wbddddddbg.',
    12: '.wbwwwrwwbg.',
    13: 'swbwwwrwwbg.',
    14: 'scbwwwwwwbg.',
  },
  // Holding a strip of tape across the glass.
  tapeLow: {
    10: 'swyyyyyyyyws',
    11: '.wbwwrrwwbg.',
    12: '.wbwwwrwwbg.',
    13: '.wbwwwrwwbg.',
    14: '.cbwwwwwwbg.',
  },
  tapeHigh: {
    8: 'syyyyyyyyyys',
    9: 'w.wwwrrwww.w',
    10: '..bwwrrwwb..',
    11: '..bwwrrwwb..',
    12: '..bwwwrwwb..',
    13: '..bwwwrwwb..',
    14: '..bwwwwwwb..',
  },
} satisfies Record<string, Record<number, string>>;

const LEGS = {
  stepA: { 17: '..ppp..ppp..', 18: '.ppp....pp..', 19: '.pp.....pp..', 20: 'kkk.....kkk.' },
  stepB: { 17: '..ppp..ppp..', 18: '..pp....ppp.', 19: '..pp.....pp.', 20: '.kkk.....kkk' },
} satisfies Record<string, Record<number, string>>;

function rows(...overrides: Record<number, string>[]): string[] {
  const out: string[] = [...BASE];
  for (const o of overrides) for (const [i, r] of Object.entries(o)) out[Number(i)] = r;
  return out;
}

const build = (r: string[]) => spriteFromRows(r, PALETTE);

/** Moves the whole frame by `dy` pixels (positive is down); edges become transparent. */
function shift(frame: PixelBuffer, dy: number): PixelBuffer {
  const out = createBuffer(frame.width, frame.height);
  const row = frame.width * 4;
  if (dy >= 0) out.data.set(frame.data.subarray(0, frame.data.length - dy * row), dy * row);
  else out.data.set(frame.data.subarray(-dy * row));
  return out;
}

/** Upper body lowered by `dip` pixels, legs unchanged. */
function breathe(frame: PixelBuffer, dip: number): PixelBuffer {
  const out = createBuffer(frame.width, frame.height);
  const row = frame.width * 4;
  out.data.set(frame.data.subarray(LEGS_START * row), LEGS_START * row);
  const upper = frame.data.subarray(0, LEGS_START * row);
  // The upper body is written last so it overlaps the top of the legs when lowered.
  out.data.set(upper.subarray(0, upper.length - dip * row), dip * row);
  return out;
}

const base = build(rows());

/** Frames in sheet order. Animations index into this list. */
const FRAMES: PixelBuffer[] = [
  /* 0 */ base,
  /* 1 */ breathe(base, 1),
  /* 2 */ build(rows(LEGS.stepA)),
  /* 3 */ build(rows(LEGS.stepB)),
  /* 4 */ shift(base, 3), // sitting: lower, legs hidden behind the desk
  /* 5 */ build(rows(UPPER.inspect)),
  /* 6 */ build(rows(UPPER.inspect, { 3: '..hhhhsshhqq' })), // eyebrow up
  /* 7 */ build(rows(UPPER.armsUp)),
  /* 8 */ shift(build(rows(UPPER.armsUp, { 7: 's..sskkss..s' })), -2), // hop
  /* 9 */ build(rows(UPPER.armsOut, { 7: MOUTH_OPEN })),
  /* 10 */ build(rows(UPPER.armsOut)),
  /* 11 */ build(rows(UPPER.armsUp, { 7: 's..sskkss..s' })),
  /* 12 */ shift(build(rows(UPPER.punch, { 7: MOUTH_OPEN })), 1), // slam down
  /* 13 */ build(rows(UPPER.phone)),
  /* 14 */ build(rows(UPPER.phone, { 7: '.w.sskkss...' })),
  /* 15 */ build(rows(UPPER.windUp, { 7: MOUTH_OPEN })),
  /* 16 */ build(rows(UPPER.punch, { 7: MOUTH_OPEN })),
  /* 17 */ build(rows(UPPER.tapeLow)),
  /* 18 */ build(rows(UPPER.tapeHigh)),
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

export function buildVinnieSheet(): PixelBuffer {
  return packSheet(FRAMES);
}

/** Number of frames in the sheet (for tests and the sheet width). */
export const VINNIE_FRAME_COUNT = FRAMES.length;
