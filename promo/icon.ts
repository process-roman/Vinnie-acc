// The app icon: Vinnie's head and shoulders, in pixel art, on the brick red.
// Writes the iOS/store icon (1024, no transparency) and Android's adaptive icon layers.
// Run with: npm run icon

import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

import { buildVinnieSheet, VINNIE_W } from '../src/scene/sprites/vinnie';
import { pixels } from './draw';

const OUT = path.join(__dirname, '..', 'assets', 'images');
const BG = '#A8321F';
/** The sprite's rows to show: the top of his hair (row 2) down to his chest. */
const TOP_ROW = 2;
const ROWS = 24;

const sheet = buildVinnieSheet();

/** Draws the bust centred across, cut off at `bottom`, `scale` screen pixels per art pixel. */
function bust(ctx: SKRSContext2D, size: number, scale: number, bottom: number): void {
  const w = VINNIE_W * scale;
  const h = ROWS * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect((size - w) / 2, bottom - h, w, h);
  ctx.clip();
  // Frame 0 of the sheet: him standing, facing you.
  pixels(ctx, sheet, (size - w) / 2, bottom - h - TOP_ROW * scale, scale, 0, VINNIE_W);
  ctx.restore();
}

function background(ctx: SKRSContext2D, size: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  // A soft light behind his head, so he doesn't sit on a flat slab.
  const glow = ctx.createRadialGradient(
    size / 2,
    size * 0.42,
    0,
    size / 2,
    size * 0.42,
    size * 0.6,
  );
  glow.addColorStop(0, 'rgba(255, 200, 120, 0.35)');
  glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

function write(name: string, draw: (ctx: SKRSContext2D, size: number) => void, size = 1024) {
  const canvas = createCanvas(size, size);
  draw(canvas.getContext('2d'), size);
  fs.writeFileSync(path.join(OUT, name), canvas.toBuffer('image/png'));
}

// iOS and the stores: full bleed, shoulders on the bottom edge.
write('icon.png', (ctx, size) => {
  background(ctx, size);
  bust(ctx, size, 40, size);
});

// Android adaptive icon: the launcher crops to a circle or squircle, so keep him in the middle.
write('android-icon-foreground.png', (ctx, size) => bust(ctx, size, 11, size * 0.78), 512);
write('android-icon-background.png', background, 512);
write(
  'android-icon-monochrome.png',
  (ctx, size) => {
    bust(ctx, size, 11, size * 0.78);
    // A single-colour silhouette: Android tints it to match the wallpaper.
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
  },
  512,
);

// The splash screen (shown 76pt wide on the paper background) and the web favicon.
write('splash-icon.png', (ctx, size) => bust(ctx, size, 8, size - 16), 224);
write(
  'favicon.png',
  (ctx, size) => {
    background(ctx, size);
    bust(ctx, size, 2, size);
  },
  48,
);

console.log(`Icons in ${OUT}`);
