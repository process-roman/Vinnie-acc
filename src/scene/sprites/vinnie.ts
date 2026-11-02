// Placeholder Vinnie: slicked dark hair, moustache, white shirt with rolled
// sleeves, suspenders, crooked red tie, calculator watch. Final art replaces this.

import { createBuffer, hex, packSheet, PixelBuffer, spriteFromRows } from '../pixels';

const PALETTE = {
  h: hex('#2b1d16'), // hair, brows, moustache
  s: hex('#e0a77a'), // skin
  d: hex('#b97c56'), // skin shadow
  e: hex('#1a1210'), // eyes
  w: hex('#f2efe6'), // shirt
  g: hex('#cfc8b8'), // shirt shadow
  r: hex('#b3262b'), // tie
  b: hex('#4a2c1c'), // suspenders
  c: hex('#7fd36b'), // calculator watch
  p: hex('#2d2f3a'), // trousers
  k: hex('#151515'), // shoes
};

const BASE = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhssssshh.',
  '..hshhsshhs.',
  '..ssesssess.',
  '..sssddssss.',
  '..shhhhhhss.',
  '...ssssss...',
  '....dddd....',
  '..wwwrrwww..',
  '.wbwwrrwwbw.',
  '.wbwwrrwwbg.',
  '.wbwwwrwwbg.',
  'swbwwwrwwbgs',
  'scbwwwwwwbgs',
  '..pppppppp..',
  '..pppppppp..',
  '..ppp..ppp..',
  '..ppp..ppp..',
  '..ppp..ppp..',
  '.kkkk..kkkk.',
] as const;

/** Rows above this index belong to the upper body, which bobs when breathing. */
const LEGS_START = 15;

export const VINNIE_W = BASE[0].length;
export const VINNIE_H = BASE.length;
/** Pixel offset of his feet (the point that stands on the grid) inside a frame. */
export const VINNIE_ANCHOR = { x: Math.floor(VINNIE_W / 2), y: VINNIE_H - 1 };

/** Upper body lowered by `dip` pixels, legs unchanged. */
function breathingFrame(base: PixelBuffer, dip: number): PixelBuffer {
  const frame = createBuffer(base.width, base.height);
  const row = base.width * 4;
  frame.data.set(base.data.subarray(LEGS_START * row), LEGS_START * row);
  const upper = base.data.subarray(0, LEGS_START * row);
  // Write the upper body last so it overlaps the top of the legs when lowered.
  frame.data.set(upper.subarray(0, upper.length - dip * row), dip * row);
  return frame;
}

export const IDLE_FRAMES = [0, 0, 1, 1] as const;
export const IDLE_FRAME_MS = 220;

export function buildVinnieIdleSheet(): PixelBuffer {
  const base = spriteFromRows(BASE, PALETTE);
  return packSheet(IDLE_FRAMES.map((dip) => breathingFrame(base, dip)));
}
