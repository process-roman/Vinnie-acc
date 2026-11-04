// Vinnie's big talking head for the opening scene, in the manner of a 90s adventure game:
// a still background and shoulders, and a head that bobs, with swappable mouths and brows.

import {
  createBuffer,
  fillRect,
  hex,
  mix,
  noise,
  packSheet,
  PixelBuffer,
  setPixel,
  shade,
} from '../pixels';

export const PORTRAIT_SIZE = 64;
/** How the mouth can be: shut, half open, wide. */
export const PORTRAIT_MOUTHS = 3;

const S = PORTRAIT_SIZE;
const SKIN = hex('#e0a77a');
const SKIN_LIGHT = hex('#f0c49c');
const SKIN_DARK = hex('#b97c56');
const STUBBLE = hex('#c28f6b');
const HAIR = hex('#2b1d16');
const HAIR_LIGHT = hex('#5e4332');
const WHITE = hex('#fbf7ec');
const EYE = hex('#1a1210');
const MOUTH = hex('#4a1512');
const TONGUE = hex('#c4504a');
const SHIRT = hex('#f2efe6');
const SHIRT_DARK = hex('#cfc8b8');
const TIE = hex('#b3262b');
const TIE_DARK = hex('#871b1f');
const STRAP = hex('#4a2c1c');

/** His office wall behind him, in low light. */
export function buildPortraitBackground(): PixelBuffer {
  const b = createBuffer(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const row = Math.floor(y / 5);
      const along = x + (row % 2) * 5;
      const mortar = y % 5 === 0 || along % 10 === 0;
      const base = mortar
        ? hex('#4d3a33')
        : mix(hex('#6d2c22'), hex('#84372a'), noise(Math.floor(along / 10), row));
      // A vignette: darker toward the edges, as if a desk lamp's on.
      const d = Math.hypot(x - S / 2, y - S / 2) / (S * 0.72);
      setPixel(b, x, y, shade(base, 1 - d * 0.65));
    }
  }
  return b;
}

/** Neck and shoulders. These stay put while the head moves. */
export function buildPortraitBody(): PixelBuffer {
  const b = createBuffer(S, S);
  fillRect(b, 25, 42, 14, 12, SKIN_DARK);
  for (let y = 50; y < S; y++) {
    const half = Math.min(29, 13 + (y - 50) * 3);
    fillRect(b, 32 - half, y, half * 2, 1, SHIRT);
    fillRect(b, 32 + half - 4, y, 4, 1, SHIRT_DARK);
  }
  // Suspenders.
  fillRect(b, 15, 54, 4, 10, STRAP);
  fillRect(b, 45, 54, 4, 10, STRAP);
  // Collar, and the tie, knotted slightly off centre.
  for (let i = 0; i < 6; i++) {
    fillRect(b, 22 + i, 49 + i, 5, 1, WHITE);
    fillRect(b, 37 - i, 49 + i, 5, 1, WHITE);
  }
  fillRect(b, 30, 52, 6, 4, TIE_DARK);
  fillRect(b, 30, 56, 7, 8, TIE);
  fillRect(b, 35, 56, 2, 8, TIE_DARK);
  return b;
}

function paintHead(b: PixelBuffer, ox: number, mouth: number, browUp: boolean): void {
  const px = (x: number, y: number, c: typeof SKIN) => setPixel(b, ox + x, y, c);
  const rect = (x: number, y: number, w: number, h: number, c: typeof SKIN) =>
    fillRect(b, ox + x, y, w, h, c);
  // The jaw drops as the mouth opens.
  const jaw = mouth === 0 ? 0 : mouth === 1 ? 1 : 3;

  // Ears.
  rect(15, 24, 3, 8, SKIN);
  rect(46, 24, 3, 8, SKIN_DARK);
  rect(16, 26, 1, 4, SKIN_DARK);
  rect(47, 26, 1, 4, shade(SKIN_DARK, 0.8));

  // Face: wide at the cheeks, a heavy jaw, lit from the left.
  for (let y = 11; y < 46 + jaw; y++) {
    for (let x = 17; x < 47; x++) {
      const dx = (x + 0.5 - 32) / 15;
      const dy = (y + 0.5 - 28) / (y < 28 ? 18 : 18 + jaw);
      if (Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6) > 1) continue;
      let c = SKIN;
      if (x >= 42) c = SKIN_DARK;
      else if (x <= 22 && y > 20 && y < 34) c = SKIN_LIGHT;
      // Five o'clock shadow.
      if (y >= 38 && (x + y) % 2 === 0) c = x >= 42 ? shade(STUBBLE, 0.85) : STUBBLE;
      px(x, y, c);
    }
  }

  // Slicked-back hair with a sheen running through it.
  for (let y = 6; y < 22; y++) {
    for (let x = 15; x < 49; x++) {
      const dx = (x + 0.5 - 32) / 17;
      const dy = (y + 0.5 - 23) / 17;
      if (dx * dx + dy * dy > 1) continue;
      // The hairline sweeps up in the middle and down at the temples.
      const line = 13 + Math.pow(Math.abs(x + 0.5 - 32) / 15, 2) * 8;
      if (y >= line) continue;
      const streak = (x - y * 2 + 200) % 9 === 0 && y < 13;
      px(x, y, streak ? HAIR_LIGHT : HAIR);
    }
  }
  rect(17, 18, 3, 8, HAIR);
  rect(44, 18, 3, 8, HAIR);

  // Brows: heavy, sloping in. The right one's the one that goes up.
  rect(21, 20, 9, 3, HAIR);
  px(29, 23, HAIR);
  px(28, 23, HAIR);
  const browY = browUp ? 17 : 20;
  rect(34, browY, 9, 3, HAIR);
  px(34, browY + 3, HAIR);
  px(35, browY + 3, HAIR);

  // Eyes.
  rect(22, 24, 7, 4, WHITE);
  rect(35, 24, 7, 4, WHITE);
  rect(25, 24, 3, 4, EYE);
  rect(37, 24, 3, 4, EYE);
  px(25, 24, WHITE);
  px(37, 24, WHITE);
  rect(22, 28, 7, 1, SKIN_DARK);
  rect(35, 28, 7, 1, SKIN_DARK);

  // That nose.
  rect(30, 24, 2, 6, SKIN_LIGHT);
  rect(32, 24, 2, 7, SKIN_DARK);
  rect(28, 30, 8, 4, SKIN);
  rect(29, 30, 4, 1, SKIN_LIGHT);
  rect(34, 31, 2, 3, SKIN_DARK);
  px(29, 33, SKIN_DARK);

  // The moustache, which curls down at the ends.
  rect(22, 35, 20, 4, HAIR);
  rect(20, 37, 3, 3, HAIR);
  rect(41, 37, 3, 3, HAIR);
  rect(19, 39, 2, 1, HAIR);
  rect(43, 39, 2, 1, HAIR);
  rect(25, 35, 6, 1, HAIR_LIGHT);
  rect(33, 35, 5, 1, HAIR_LIGHT);

  // The mouth.
  if (mouth === 0) {
    rect(27, 39, 10, 1, SKIN_DARK);
    rect(28, 41, 8, 1, SKIN_DARK);
  } else if (mouth === 1) {
    rect(26, 39, 12, 3, MOUTH);
    rect(27, 39, 10, 1, WHITE);
    rect(29, 41, 6, 1, TONGUE);
    rect(27, 43, 10, 1, SKIN_DARK);
  } else {
    rect(25, 39, 14, 6, MOUTH);
    rect(26, 39, 12, 2, WHITE);
    rect(28, 43, 8, 2, TONGUE);
    rect(26, 46, 12, 1, SKIN_DARK);
  }
}

/** Every mouth with the brow flat, then every mouth with it raised, side by side. */
export function buildPortraitHeadSheet(): PixelBuffer {
  const frames: PixelBuffer[] = [];
  for (const browUp of [false, true]) {
    for (let mouth = 0; mouth < PORTRAIT_MOUTHS; mouth++) {
      const b = createBuffer(S, S);
      paintHead(b, 0, mouth, browUp);
      frames.push(b);
    }
  }
  return packSheet(frames);
}

/** Lids to draw over the eyes when he blinks. */
export function buildPortraitBlink(): PixelBuffer {
  const b = createBuffer(S, S);
  fillRect(b, 22, 24, 7, 4, SKIN);
  fillRect(b, 35, 24, 7, 4, SKIN);
  fillRect(b, 22, 27, 7, 1, EYE);
  fillRect(b, 35, 27, 7, 1, EYE);
  return b;
}
