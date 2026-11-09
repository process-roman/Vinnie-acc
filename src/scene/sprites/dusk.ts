// The backdrop for the opening scene: Brooklyn at dusk, in pixel art. A warm sky in stepped
// bands, a striped setting sun, Manhattan lighting up, the bridge in silhouette, and the river.

import { createBuffer, hex, mix, noise, PixelBuffer, Rgba, setPixel } from '../pixels';

export const DUSK_W = 96;
export const DUSK_H = 208;
/** Where the river starts. */
const HORIZON = 150;

/** Top of the sky to the horizon. */
const SKY = [
  '#2d2350',
  '#46306a',
  '#6b3a78',
  '#934476',
  '#bd5670',
  '#de7466',
  '#ef9a66',
  '#f6c27a',
].map((c) => hex(c));
const SUN_TOP = hex('#ffe08a');
const SUN_BOTTOM = hex('#ff8a5c');
const CITY = hex('#4a2f62');
const CITY_NEAR = hex('#36234d');
const WINDOW = hex('#ffd27a');
const BRIDGE = hex('#2a1b3d');
const WATER = hex('#3b2a5c');
const WATER_DEEP = hex('#271c40');
const STAR = hex('#fff1d0');

const SUN = { x: 64, r: 22 };
const TOWER = { x: 12, w: 9, top: 92 };

function skyAt(x: number, y: number): Rgba {
  const k = (y / HORIZON) * (SKY.length - 1);
  const band = Math.floor(k);
  // A checkerboard where two bands meet, the way old games blended colours.
  const blend = k - band > 0.8 && (x + y) % 2 === 0;
  return SKY[Math.min(SKY.length - 1, band + (blend ? 1 : 0))];
}

function sunAt(x: number, y: number): Rgba | null {
  const d = Math.hypot(x + 0.5 - SUN.x, y + 0.5 - HORIZON);
  if (d > SUN.r || y >= HORIZON) return null;
  // The lower half is cut into ever-thicker stripes.
  const below = HORIZON - y;
  if (below < 14 && below % 4 < Math.ceil((14 - below) / 5)) return null;
  return mix(SUN_TOP, SUN_BOTTOM, Math.floor(((y - (HORIZON - SUN.r)) / SUN.r) * 4) / 4);
}

function skylineTop(x: number, far: boolean): number {
  const block = Math.floor((x + (far ? 0 : 3)) / (far ? 5 : 7));
  const tall = noise(block, far ? 1 : 2);
  const height = far ? 10 + tall * 26 : 4 + tall * 12;
  // One tower stands above the rest.
  const spire = far && Math.abs(x - 78) < 2 ? 44 : far && Math.abs(x - 78) < 1 ? 50 : 0;
  return HORIZON - Math.max(height, spire);
}

function bridgeAt(x: number, y: number): boolean {
  const deck = 138;
  if (y >= deck && y <= deck + 1) return true;
  // The tower, with its two pointed arches.
  const tx = x - TOWER.x;
  if (tx >= 0 && tx < TOWER.w && y >= TOWER.top && y < HORIZON) {
    const arch = (cx: number) =>
      Math.abs(tx + 0.5 - cx) < 1.2 && y > 112 - Math.abs(tx + 0.5 - cx) * 2 && y < deck;
    return !(arch(2.5) || arch(6.5));
  }
  // Main cable sagging off to the right, with suspenders hanging from it.
  if (x > TOWER.x + TOWER.w) {
    const k = (x - TOWER.x - TOWER.w) / (DUSK_W - TOWER.x - TOWER.w);
    const cable = TOWER.top + 2 + (deck - 6 - TOWER.top) * Math.sin((k * Math.PI) / 2);
    if (Math.abs(y - cable) < 0.6) return true;
    if (x % 4 === 0 && y > cable && y < deck) return true;
  }
  return false;
}

export function buildDusk(): PixelBuffer {
  const b = createBuffer(DUSK_W, DUSK_H);
  for (let y = 0; y < DUSK_H; y++) {
    for (let x = 0; x < DUSK_W; x++) {
      let c: Rgba;
      if (y >= HORIZON) {
        // The river, with the sun's reflection breaking up in it.
        const depth = y - HORIZON;
        c = depth > 30 ? WATER_DEEP : WATER;
        const spread = SUN.r * (1 - depth / 70);
        const glint =
          Math.abs(x + 0.5 - SUN.x) < spread && depth % 3 === 0 && noise(x >> 1, y) > 0.35;
        if (glint) c = mix(SUN_BOTTOM, WATER, Math.min(0.8, depth / 60));
        else if (noise(x >> 2, y) > 0.93) c = mix(WATER, SKY[5], 0.35);
      } else {
        c = skyAt(x, y);
        if (y < 60 && noise(x, y) > 0.985) c = STAR;
        c = sunAt(x, y) ?? c;
        if (y >= skylineTop(x, true)) {
          c = CITY;
          if (x % 2 === 0 && y % 3 === 0 && noise(x, y + 7) > 0.6) c = WINDOW;
        }
        if (y >= skylineTop(x, false) && x > 30) c = CITY_NEAR;
      }
      if (bridgeAt(x, y)) c = BRIDGE;
      setPixel(b, x, y, c);
    }
  }
  return b;
}
