// Drawing pieces shared by the promo video and the store screenshots: fonts, the app's colours,
// pixel art scaled with hard edges, and the game's speech bubble.

import { Canvas, createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';

import { PixelBuffer } from '../src/scene/pixels';

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'PixelifySans.ttf'), 'Pixelify');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter.ttf'), 'Inter');

export const C = {
  paper: '#F4EDE1',
  card: '#FFFAF0',
  ink: '#2B1D16',
  inkSoft: '#7A6A5A',
  line: '#E3D7C3',
  mustard: '#F2B53A',
  mustardDark: '#B9831A',
  brick: '#A4523A',
  good: '#4E9F5A',
  yellow: '#F3E2AE',
  red: '#A8321F',
  night: '#1D1714',
};

const pixelCanvases = new Map<PixelBuffer, Canvas>();
export function asCanvas(buf: PixelBuffer): Canvas {
  let c = pixelCanvases.get(buf);
  if (!c) {
    c = createCanvas(buf.width, buf.height);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(buf.width, buf.height);
    img.data.set(buf.data);
    ctx.putImageData(img, 0, 0);
    pixelCanvases.set(buf, c);
  }
  return c;
}

/** Pixel art, scaled up with hard edges. */
export function pixels(
  ctx: SKRSContext2D,
  buf: PixelBuffer,
  x: number,
  y: number,
  scale: number,
  sx = 0,
  sw = buf.width,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(asCanvas(buf), sx, 0, sw, buf.height, x, y, sw * scale, buf.height * scale);
}

export function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Word-wrap to a width. A newline in the text always breaks. */
export function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  if (text.includes('\n')) return text.split('\n').flatMap((part) => wrap(ctx, part, maxWidth));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A speech bubble like the game's: cream, thick ink border, a tail pointing at the speaker. */
export function bubble(
  ctx: SKRSContext2D,
  full: string,
  shown: string,
  anchor: { x: number; y: number },
  size = 52,
  frameWidth = 1080,
): void {
  ctx.font = `bold ${size}px Inter`;
  const maxW = Math.min(860, frameWidth - 60);
  // Size from the full text, so the bubble doesn't grow as it types.
  const lines = wrap(ctx, full, maxW - 80);
  const lineH = size * 1.28;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 80);
  const h = lines.length * lineH + 60;
  const x = Math.min(frameWidth - w - 30, Math.max(30, anchor.x - w / 2));
  const y = anchor.y - h - 40;
  ctx.fillStyle = C.card;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 8;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  // Tail.
  const tx = Math.min(x + w - 60, Math.max(x + 60, anchor.x));
  ctx.beginPath();
  ctx.moveTo(tx - 22, y + h - 4);
  ctx.lineTo(tx, y + h + 34);
  ctx.lineTo(tx + 22, y + h - 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tx - 22, y + h);
  ctx.lineTo(tx, y + h + 34);
  ctx.lineTo(tx + 22, y + h);
  ctx.stroke();
  // Typed text, laid out on the full text's lines.
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'top';
  let left = shown.length;
  lines.forEach((l, i) => {
    if (left <= 0) return;
    ctx.fillText(l.slice(0, left), x + 40, y + 30 + i * lineH);
    left -= l.length + 1;
  });
}
