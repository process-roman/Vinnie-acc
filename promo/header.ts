// The App Store product page header: a wide banner with the pitch on the left and the office
// on the right. Apple takes 5244x2950 (16:9) and 3840x1646 (about 21:9).
// Run with: npm run header

import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

import type { RoomState } from '../src/domain/roomState';
import { composeSnapshot } from '../src/scene/composition';
import { WAYPOINTS } from '../src/scene/room';
import { pixels, roundRect, wrap } from './draw';

const OUT = path.join(__dirname, 'out', 'header');

const HEADLINE_LINES = ['Funny pixel', 'budget tracker'];
const SUBTITLE = 'Set limits, log spending, and break bad habits with a grumpy accountant.';
const LABELS = ['Category limits', 'Weekly reviews', '100% private'];

const BG = '#A8321F';
const CREAM = '#FFF6E2';
const ACCENT = '#F6C431';

const ROOM: RoomState = {
  plant: 'healthy',
  weather: 'sunny',
  poster: 'intact',
  receipts: 3,
  espressoSteaming: true,
  cat: 'sitting',
  streak: 4,
};

const office = composeSnapshot({
  room: ROOM,
  cosmetics: {},
  vinnieFrame: 7,
  at: WAYPOINTS.desk,
  crackLevel: 0,
  crackSeed: 1,
});

/** Draws the labels as pills in one row from x, returning the row's width. */
function labels(ctx: SKRSContext2D, x: number, y: number, size: number): number {
  ctx.font = `600 ${size}px Inter`;
  ctx.textBaseline = 'middle';
  const padX = size * 0.75;
  const pillH = size * 2.1;
  const gap = size * 0.6;
  let cx = x;
  for (const label of LABELS) {
    const w = ctx.measureText(label).width + padX * 2;
    ctx.fillStyle = 'rgba(255, 246, 226, 0.14)';
    roundRect(ctx, cx, y, w, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 246, 226, 0.45)';
    ctx.lineWidth = Math.max(2, size * 0.06);
    roundRect(ctx, cx, y, w, pillH, pillH / 2);
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.fillText(label, cx + padX, y + pillH / 2);
    cx += w + gap;
  }
  ctx.textBaseline = 'alphabetic';
  return cx - gap - x;
}

function render(w: number, h: number): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // A warm brick wall, a little lighter where the office stands.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.72, h * 0.5, 0, w * 0.72, h * 0.5, h * 0.75);
  glow.addColorStop(0, 'rgba(255, 200, 120, 0.28)');
  glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // The office: a whole-number scale, as large as fits the right half, near the right edge.
  const scale = Math.floor(Math.min((h * 0.84) / office.height, (w * 0.48) / office.width));
  const ow = office.width * scale;
  const oh = office.height * scale;
  const officeX = Math.round(w * 0.95 - ow);
  pixels(ctx, office, officeX, Math.round((h - oh) / 2 + h * 0.02), scale);

  // The pitch, in the column left of the office, vertically centred as a block.
  const left = w * 0.08;
  const colW = officeX - left - w * 0.03;
  // Always "Funny pixel / budget tracker", as large as the column allows.
  const head = HEADLINE_LINES;
  ctx.font = 'bold 100px Inter';
  const widest = Math.max(...head.map((line) => ctx.measureText(line).width));
  const size = Math.round(Math.min(h * 0.13, (colW * 100) / widest));
  // The subtitle in two lines at most.
  let subSize = Math.round(size * 0.4);
  ctx.font = `${subSize}px Inter`;
  let sub = wrap(ctx, SUBTITLE, colW);
  while (sub.length > 2) {
    subSize -= 2;
    ctx.font = `${subSize}px Inter`;
    sub = wrap(ctx, SUBTITLE, colW);
  }
  // The labels shrink until their row fits the column.
  const rowWidth = (s: number) => {
    ctx.font = `600 ${s}px Inter`;
    const text = LABELS.reduce((sum, label) => sum + ctx.measureText(label).width, 0);
    return text + LABELS.length * s * 1.5 + (LABELS.length - 1) * s * 0.6;
  };
  let labelSize = Math.round(subSize * 0.8);
  while (rowWidth(labelSize) > colW) labelSize -= 2;

  const headH = head.length * size * 1.08;
  const subH = sub.length * subSize * 1.35;
  const gap1 = size * 0.45;
  const gap2 = subSize * 1.3;
  const labelsH = labelSize * 2.1;
  let y = (h - (headH + gap1 + subH + gap2 + labelsH)) / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${size}px Inter`;
  head.forEach((line, i) => {
    // "pixel" in the accent colour.
    const yy = y + size * 0.9 + i * size * 1.08;
    let x = left;
    for (const word of line.split(' ')) {
      ctx.fillStyle = word.toLowerCase() === 'pixel' ? ACCENT : CREAM;
      ctx.fillText(word, x, yy);
      x += ctx.measureText(`${word} `).width;
    }
  });
  y += headH + gap1;

  ctx.font = `${subSize}px Inter`;
  ctx.fillStyle = 'rgba(255, 246, 226, 0.88)';
  sub.forEach((line, i) => ctx.fillText(line, left, y + subSize + i * subSize * 1.35));
  y += subH + gap2;

  labels(ctx, left, y, labelSize);
  return canvas.toBuffer('image/png');
}

const SIZES = [
  { name: 'header-16x9', w: 5244, h: 2950 },
  { name: 'header-wide', w: 3840, h: 1646 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  fs.writeFileSync(path.join(OUT, `${size.name}.png`), render(size.w, size.h));
}
console.log(`Header in ${OUT}`);
