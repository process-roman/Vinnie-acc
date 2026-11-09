// Renders the promo video from the game's own art: every frame is drawn here, the soundtrack
// is composed in music.ts, and ffmpeg turns it into an MP4.
// Run with: npm run promo   (add --stills to only write a few PNGs for checking)

import { createCanvas, GlobalFonts, SKRSContext2D, Canvas } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import ffmpegPath from 'ffmpeg-static';

import type { RoomState } from '../src/domain/roomState';
import { composeSnapshot } from '../src/scene/composition';
import { rasterizeCrack } from '../src/scene/crack';
import { GridPoint, gridToScreen } from '../src/scene/iso';
import { PixelBuffer } from '../src/scene/pixels';
import { ROOM_ORIGIN, ROOM_W, WAYPOINTS } from '../src/scene/room';
import { buildAlertBubble } from '../src/scene/sprites/bubble';
import {
  buildPortraitBackground,
  buildPortraitBlink,
  buildPortraitBody,
  buildPortraitHeadSheet,
  PORTRAIT_MOUTHS,
  PORTRAIT_SIZE,
} from '../src/scene/sprites/portrait';
import { VINNIE_ANCHOR } from '../src/scene/sprites/vinnie';
import { composeMusic, RATE } from './music';
import { BEAT, DURATION, FPS, HEIGHT, T, WIDTH } from './timeline';

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'PixelifySans.ttf'), 'Pixelify');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter.ttf'), 'Inter');

const C = {
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

// --- Drawing helpers -----------------------------------------------------------------

const pixelCanvases = new Map<PixelBuffer, Canvas>();
function asCanvas(buf: PixelBuffer): Canvas {
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
function pixels(
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

function roundRect(
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

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
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

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const typed = (text: string, t: number, start: number, perSecond = 30) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * perSecond)));

/** A speech bubble like the game's: cream, thick ink border, a tail pointing at the speaker. */
function bubble(
  ctx: SKRSContext2D,
  full: string,
  shown: string,
  anchor: { x: number; y: number },
  size = 52,
): void {
  ctx.font = `bold ${size}px Inter`;
  const maxW = 860;
  // Size from the full text, so the bubble doesn't grow as it types.
  const lines = wrap(ctx, full, maxW - 80);
  const lineH = size * 1.28;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 80);
  const h = lines.length * lineH + 60;
  const x = Math.min(WIDTH - w - 30, Math.max(30, anchor.x - w / 2));
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

// --- The office, as the app shows it -------------------------------------------------

const ROOM: RoomState = {
  plant: 'healthy',
  weather: 'sunny',
  poster: 'intact',
  receipts: 3,
  espressoSteaming: true,
  cat: 'sleeping',
  streak: 3,
};
const OFFICE_SCALE = 4;
const OFFICE_X = (WIDTH - ROOM_W * OFFICE_SCALE) / 2;
const OFFICE_Y = 430;

const snapshots = new Map<string, PixelBuffer>();
function office(frame: number, at: GridPoint): PixelBuffer {
  const key = `${frame}:${at.gx.toFixed(3)}:${at.gy.toFixed(3)}`;
  let s = snapshots.get(key);
  if (!s) {
    s = composeSnapshot({
      room: ROOM,
      cosmetics: {},
      vinnieFrame: frame,
      at,
      crackLevel: 0,
      crackSeed: 1,
    });
    snapshots.set(key, s);
  }
  return s;
}

/** Where a grid point's head would be on the video, before any camera zoom. */
function headAt(at: GridPoint): { x: number; y: number } {
  const feet = gridToScreen(at, ROOM_ORIGIN);
  return {
    x: OFFICE_X + feet.x * OFFICE_SCALE,
    y: OFFICE_Y + (Math.round(feet.y) - VINNIE_ANCHOR.y + 4) * OFFICE_SCALE,
  };
}

function appChrome(ctx: SKRSContext2D, status: string): void {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';
  // Header.
  ctx.fillStyle = C.brick;
  ctx.font = 'bold 76px Inter';
  ctx.fillText('Vinnie', 56, 170);
  ctx.fillStyle = C.inkSoft;
  ctx.font = '32px Inter';
  ctx.fillText('November · Classic', 58, 220);
  // Budget card.
  ctx.fillStyle = C.card;
  roundRect(ctx, 650, 90, 374, 170, 28);
  ctx.fill();
  ctx.fillStyle = C.inkSoft;
  ctx.font = '26px Inter';
  ctx.textAlign = 'right';
  ctx.fillText('This month', 990, 140);
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 60px Inter';
  ctx.fillText('$618', 990, 200);
  ctx.fillStyle = C.inkSoft;
  ctx.font = '26px Inter';
  ctx.fillText('of $2,000', 990, 236);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.line;
  roundRect(ctx, 680, 248, 310, 8, 4);
  ctx.fill();
  ctx.fillStyle = C.good;
  roundRect(ctx, 680, 248, 96, 8, 4);
  ctx.fill();
  // Mood bar.
  ctx.fillStyle = C.card;
  roundRect(ctx, 40, 290, 1000, 84, 42);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 30px Inter';
  ctx.fillText('Mood', 80, 343);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < 8 ? C.mustard : C.line;
    roundRect(ctx, 190 + i * 54, 318, 46, 26, 6);
    ctx.fill();
  }
  ctx.fillStyle = C.mustardDark;
  ctx.font = 'bold 30px Inter';
  ctx.fillText('Relaxed', 860, 343);
  // Status line and bottom bar.
  ctx.fillStyle = C.inkSoft;
  ctx.font = '32px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(status, WIDTH / 2, 1560);
  ctx.fillStyle = C.mustardDark;
  roundRect(ctx, 290, 1680, 500, 124, 62);
  ctx.fill();
  ctx.fillStyle = C.mustard;
  roundRect(ctx, 290, 1672, 500, 120, 60);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 46px Inter';
  ctx.fillText('+ New Receipt', WIDTH / 2, 1748);
  ctx.font = 'bold 34px Inter';
  ctx.fillText('History', 140, 1745);
  ctx.fillText('Budget', 940, 1745);
  ctx.textAlign = 'left';
}

type Camera = { fx: number; fy: number; zoom: number };
const NO_ZOOM: Camera = { fx: WIDTH / 2, fy: HEIGHT / 2, zoom: 1 };

/** The app screen with Vinnie in the office, seen through a camera that can zoom. */
function app(ctx: SKRSContext2D, frame: number, at: GridPoint, cam: Camera, status: string): void {
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.fx, -cam.fy);
  appChrome(ctx, status);
  pixels(ctx, office(frame, at), OFFICE_X, OFFICE_Y, OFFICE_SCALE);
  ctx.restore();
}

/** Where a point in the app ends up through the camera. */
const throughCamera = (p: { x: number; y: number }, cam: Camera) => ({
  x: WIDTH / 2 + (p.x - cam.fx) * cam.zoom,
  y: HEIGHT / 2 + (p.y - cam.fy) * cam.zoom,
});

// --- Crime-caper title card ----------------------------------------------------------------

function freezeTint(ctx: SKRSContext2D): void {
  ctx.fillStyle = 'rgba(70, 35, 10, 0.38)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** A stamped name card: big name, a role, and a line, slamming in at an angle. */
function nameCard(
  ctx: SKRSContext2D,
  t: number,
  start: number,
  name: string,
  role: string,
  line: string,
): void {
  const k = ease((t - start) / 0.12);
  const scale = 1.5 - 0.5 * k;
  ctx.save();
  ctx.translate(120, 1260);
  ctx.rotate(-0.05);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.min(1, k * 1.5);
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 190px Pixelify';
  ctx.fillStyle = C.ink;
  ctx.fillText(name, 10, 10);
  ctx.fillStyle = C.yellow;
  ctx.fillText(name, 0, 0);
  ctx.font = 'bold 64px Pixelify';
  ctx.fillStyle = C.mustard;
  ctx.fillText(role, 6, 90);
  ctx.restore();
  // The line, typed underneath on a strip of paper.
  const shown = typed(line, t, start + 0.25, 40);
  if (!shown) return;
  ctx.font = 'bold 48px Inter';
  const w = ctx.measureText(line).width + 60;
  ctx.fillStyle = C.card;
  ctx.fillRect(110, 1440, w, 90);
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, 140, 1486);
}

// --- The receipt ---------------------------------------------------------------------

function receipt(ctx: SKRSContext2D, t: number, start: number, leave: number): void {
  const inK = ease((t - start) / 0.25);
  const outK = ease((t - leave) / 0.25);
  const y = 1950 - inK * 700 + outK * 900;
  const x = 240;
  const w = 600;
  const h = 520;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.04);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(14, 16, w, h);
  ctx.fillStyle = '#FFFDF6';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= 20; i++) ctx.lineTo((w / 20) * i, i % 2 ? 0 : 16);
  ctx.lineTo(w, h);
  for (let i = 20; i >= 0; i--) ctx.lineTo((w / 20) * i, h - (i % 2 ? 0 : 16));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 54px Pixelify';
  ctx.fillText('RECEIPT', w / 2, 100);
  ctx.font = '32px Pixelify';
  ctx.fillText('- - - - - - - - - - - -', w / 2, 150);
  ctx.textAlign = 'left';
  ctx.font = 'bold 46px Pixelify';
  ctx.fillText('OAT LATTE', 50, 240);
  ctx.textAlign = 'right';
  ctx.fillText('$14.00', w - 50, 240);
  ctx.font = '32px Pixelify';
  ctx.textAlign = 'center';
  ctx.fillText('- - - - - - - - - - - -', w / 2, 300);
  ctx.textAlign = 'left';
  ctx.font = 'bold 50px Pixelify';
  ctx.fillText('TOTAL', 50, 380);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.red;
  ctx.fillText('$14.00', w - 50, 380);
  ctx.fillStyle = C.inkSoft;
  ctx.textAlign = 'center';
  ctx.font = '34px Pixelify';
  ctx.fillText('THANK YOU!', w / 2, 460);
  ctx.textAlign = 'left';
  ctx.restore();
}

// --- The phone call --------------------------------------------------------------------

const portrait = {
  background: buildPortraitBackground(),
  body: buildPortraitBody(),
  heads: buildPortraitHeadSheet(),
  blink: buildPortraitBlink(),
};
const MOUTH_PATTERN = [1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 2, 1, 0, 1];

function drawPortrait(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  scale: number,
  t: number,
  talking: boolean,
): void {
  pixels(ctx, portrait.background, x, y, scale);
  pixels(ctx, portrait.body, x, y, scale);
  const mouth = talking ? MOUTH_PATTERN[Math.floor(t / 0.085) % MOUTH_PATTERN.length] : 0;
  const browUp = talking && Math.floor(t / 1.9) % 3 === 1 ? 1 : 0;
  const bob = talking ? [0, -1, -2, -1][Math.floor(t / 0.15) % 4] : 0;
  const frame = mouth + browUp * PORTRAIT_MOUTHS;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, PORTRAIT_SIZE * scale, PORTRAIT_SIZE * scale);
  ctx.clip();
  pixels(ctx, portrait.heads, x, y + bob * scale, scale, frame * PORTRAIT_SIZE, PORTRAIT_SIZE);
  if (t % 3.4 < 0.13) pixels(ctx, portrait.blink, x, y + bob * scale, scale);
  ctx.restore();
}

/** A phone handset icon, drawn rather than typed: the fonts don't have one. */
function handset(ctx: SKRSContext2D, cx: number, cy: number, angle: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle - Math.PI / 4);
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 44, Math.PI * 0.75, Math.PI * 1.75);
  ctx.stroke();
  for (const a of [Math.PI * 0.75, Math.PI * 1.75]) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 44, Math.sin(a) * 44, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function call(ctx: SKRSContext2D, t: number): void {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const answered = t >= T.answer;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (!answered) {
    // Ringing.
    ctx.fillStyle = '#3A2E28';
    roundRect(ctx, 284, 300, 512, 512, 40);
    ctx.fill();
    drawPortrait(ctx, 316, 332, 7, t, false);
    ctx.fillStyle = C.card;
    ctx.font = 'bold 110px Inter';
    ctx.fillText('Vinnie', WIDTH / 2, 990);
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 4));
    ctx.fillStyle = '#CBBBA8';
    ctx.font = '44px Inter';
    ctx.fillText('mobile · calling…', WIDTH / 2, 1070);
    ctx.globalAlpha = 1;
    for (const [cx, color, angle, label] of [
      [260, '#D64541', Math.PI * 0.75, 'Decline'],
      [820, '#3FAE5B', 0, 'Answer'],
    ] as const) {
      // The answer button pulses, waiting for a thumb.
      const r = 110 + (label === 'Answer' ? Math.sin(t * 8) * 6 : 0);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, 1560, r, 0, Math.PI * 2);
      ctx.fill();
      handset(ctx, cx, 1560, angle);
      ctx.fillStyle = C.card;
      ctx.font = '38px Inter';
      ctx.fillText(label, cx, 1730);
    }
  } else {
    // On the call: his talking head and the line.
    ctx.fillStyle = '#3A2E28';
    roundRect(ctx, 300, 150, 480, 84, 42);
    ctx.fill();
    ctx.fillStyle = '#3FAE5B';
    ctx.beginPath();
    ctx.arc(360, 192, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.card;
    ctx.font = 'bold 40px Inter';
    ctx.fillText(`Vinnie · 0:0${Math.min(9, Math.floor(t - T.answer) + 1)}`, WIDTH / 2 + 24, 207);
    const line = '$14 on coffee?! Oh, I see. We got a f*@king millionaire over here!';
    const shown = typed(line, t, T.answer + 0.2, 26);
    drawPortrait(ctx, 156, 900, 12, t, shown.length < line.length);
    ctx.textAlign = 'left';
    bubble(ctx, line, shown, { x: WIDTH / 2, y: 880 }, 58);
  }
  ctx.textAlign = 'left';
}

// --- End card ------------------------------------------------------------------------

function endCard(ctx: SKRSContext2D, t: number): void {
  const k = t - T.end;
  ctx.fillStyle = C.yellow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // The portrait drops in, then the name.
  const drop = ease(k / 0.3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(WIDTH / 2 - 216, 210 - (1 - drop) * 300, 432, 432);
  drawPortrait(ctx, WIDTH / 2 - 200, 226 - (1 - drop) * 300, 6.25, t, false);
  ctx.font = 'bold 200px Pixelify';
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = ease((k - 0.15) / 0.2);
  ctx.fillText('Vinnie', WIDTH / 2, 860);
  ctx.globalAlpha = ease((k - 0.4) / 0.25);
  ctx.font = 'bold 56px Inter';
  ctx.fillText('The budget app that gets mad', WIDTH / 2, 970);
  ctx.fillText('when you overspend.', WIDTH / 2, 1040);
  // The value, one line per beat.
  const promises = ['Track every dollar.', 'Set your limits.', 'Stay out of trouble.'];
  promises.forEach((p, i) => {
    ctx.globalAlpha = ease((k - 0.9 - i * BEAT) / 0.15);
    ctx.font = 'bold 60px Pixelify';
    ctx.fillStyle = i === 2 ? C.red : C.ink;
    ctx.fillText(p, WIDTH / 2, 1200 + i * 90);
  });
  ctx.globalAlpha = ease((k - 0.9 - 3 * BEAT) / 0.2);
  ctx.fillStyle = C.ink;
  roundRect(ctx, WIDTH / 2 - 330, 1530, 660, 130, 18);
  ctx.fill();
  ctx.fillStyle = C.yellow;
  ctx.font = 'bold 76px Inter';
  ctx.fillText('getvinnie.app', WIDTH / 2, 1620);
  ctx.fillStyle = C.ink;
  ctx.font = '40px Inter';
  ctx.fillText('iPhone & Android · Coming soon', WIDTH / 2, 1740);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// --- The whole thing, frame by frame ---------------------------------------------------------------

const CHAIR = WAYPOINTS.chair;
const DESK = WAYPOINTS.desk;
const CAMERA = WAYPOINTS.camera;
const CAT_AT = {
  x: OFFICE_X + gridToScreen({ gx: 6.1, gy: 0.2 }, ROOM_ORIGIN).x * OFFICE_SCALE,
  y: OFFICE_Y + (gridToScreen({ gx: 6.1, gy: 0.2 }, ROOM_ORIGIN).y - 22 - 6) * OFFICE_SCALE,
};

const LINES = {
  open: 'Heard you need a finance guy.',
  rule: "Kid, it's simple. You don't buy stupid things, and we're good.",
  warning: "But if you don't follow the rule…",
};

const idleFrame = (t: number) => [0, 0, 1, 1][Math.floor(t / 0.22) % 4];
const zoomIn = (
  t: number,
  start: number,
  target: { x: number; y: number },
  zoom: number,
): Camera => {
  const k = ease((t - start) / 0.18);
  return {
    fx: WIDTH / 2 + (target.x - WIDTH / 2) * k,
    fy: HEIGHT / 2 + (target.y - HEIGHT / 2) * k,
    zoom: 1 + (zoom - 1) * k,
  };
};

// The crack, worked out once, where the fist lands: the middle of the zoomed-in shot.
const CRACK = rasterizeCrack(3, WIDTH / 3, HEIGHT / 3, 7, { x: WIDTH / 6, y: HEIGHT / 3 / 2 - 20 });
const ALERT = buildAlertBubble();

function drawFrame(ctx: SKRSContext2D, t: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let shake = 0;
  if (t >= T.punch && t < T.punch + 0.35)
    shake = Math.sin((t - T.punch) * 90) * 26 * (1 - (t - T.punch) / 0.35);
  ctx.translate(shake, 0);

  if (t < T.vinnieCard) {
    // Vinnie at his desk, looking up.
    app(ctx, 4, CHAIR, NO_ZOOM, 'Vinnie is doing your taxes.');
    const head = headAt(CHAIR);
    bubble(ctx, LINES.open, typed(LINES.open, t, 0.15), { x: head.x, y: head.y + 20 });
  } else if (t < T.rule) {
    const head = headAt(CHAIR);
    const cam = zoomIn(t, T.vinnieCard, { x: head.x, y: head.y + 120 }, 3.2);
    app(ctx, 4, CHAIR, cam, 'Vinnie is doing your taxes.');
    if (t > T.vinnieCard + 0.18) {
      freezeTint(ctx);
      nameCard(
        ctx,
        t,
        T.vinnieCard + 0.18,
        'VINNIE',
        'the accountant',
        'Has opinions about your coffee.',
      );
    }
  } else if (t < T.lucCard) {
    app(ctx, idleFrame(t), DESK, NO_ZOOM, 'Vinnie is explaining the rules.');
    const head = headAt(DESK);
    bubble(ctx, LINES.rule, typed(LINES.rule, t, T.rule + 0.1, 28), head);
  } else if (t < T.warning) {
    const cam = zoomIn(t, T.lucCard, CAT_AT, 4.5);
    app(ctx, idleFrame(t), DESK, cam, 'Luc is asleep on the radiator.');
    if (t > T.lucCard + 0.18) {
      freezeTint(ctx);
      nameCard(ctx, t, T.lucCard + 0.18, 'LUC', 'the muscle', 'Bites. Mostly the furniture.');
      const cat = throughCamera(CAT_AT, cam);
      if (t > T.lucCard + 0.35) bubble(ctx, 'Meow.', 'Meow.', { x: cat.x, y: cat.y - 40 }, 64);
    }
  } else if (t < T.receipt) {
    app(ctx, Math.floor(t / 0.16) % 2 === 0 ? 9 : 10, DESK, NO_ZOOM, 'Vinnie is fuming.');
    bubble(ctx, LINES.warning, typed(LINES.warning, t, T.warning + 0.1, 28), headAt(DESK));
  } else if (t < T.walk) {
    // The receipt lands. The music's gone. He reads it.
    const frame = t > T.receipt + 0.7 ? 6 : 5;
    app(ctx, frame, DESK, NO_ZOOM, 'Vinnie is reading your receipt…');
    receipt(ctx, t, T.receipt, T.walk - 0.15);
  } else if (t < T.ring) {
    // He walks up to the glass, the camera closing in on him, and punches.
    const k = Math.min(1, (t - T.walk) / (T.punch - T.walk - 0.35));
    const at = { gx: DESK.gx + (CAMERA.gx - DESK.gx) * k, gy: DESK.gy + (CAMERA.gy - DESK.gy) * k };
    let frame = [2, 0, 3, 0][Math.floor(t / 0.13) % 4];
    if (k >= 1) frame = t < T.punch ? 15 : 16;
    const head = headAt(at);
    const zoom = 1 + 1.6 * ease((t - T.walk) / (T.punch - T.walk));
    const cam = { fx: head.x, fy: head.y + 60, zoom };
    app(ctx, frame, at, cam, '');
    if (k >= 1 && t < T.punch) {
      const h = throughCamera(head, cam);
      pixels(ctx, ALERT, h.x - 8 * 8, h.y - 22 * 8, 8);
    }
  } else if (t < T.end) {
    call(ctx, t);
  } else {
    endCard(ctx, t);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // The crack stays over everything once it's there.
  // Full strength over the punch, then it fades back so the call and the end card read.
  if (t >= T.punch) {
    ctx.globalAlpha = t < T.ring ? 1 : 0.32;
    pixels(ctx, CRACK, 0, 0, 3);
    ctx.globalAlpha = 1;
  }
}

// --- Sound --------------------------------------------------------------------------------------------------------

function readWav(name: string): Float32Array {
  const b = fs.readFileSync(path.join(ROOT, 'assets', 'sounds', `${name}.wav`));
  const rate = b.readUInt32LE(24);
  if (rate !== RATE) throw new Error(`${name}.wav is ${rate} Hz, the mix is ${RATE}`);
  const n = (b.length - 44) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(44 + i * 2) / 32768;
  return out;
}

function mix(): Buffer {
  const total = Math.round(DURATION * RATE);
  const out = composeMusic(DURATION);
  const place = (name: string, at: number, gain: number, until?: number) => {
    const s = readWav(name);
    const start = Math.round(at * RATE);
    const end = until === undefined ? s.length : Math.round((until - at) * RATE);
    for (let i = 0; i < end && start + i < total; i++) out[start + i] += s[i % s.length] * gain;
  };
  const typing = (text: string, start: number, perSecond: number) =>
    start + text.length / perSecond;
  place('click', T.vinnieCard + 0.18, 0.7);
  place('talk', T.rule + 0.1, 0.35, typing(LINES.rule, T.rule + 0.1, 28));
  place('click', T.lucCard + 0.18, 0.7);
  place('meow', T.lucCard + 0.35, 0.9);
  place('talk', T.warning + 0.1, 0.35, typing(LINES.warning, T.warning + 0.1, 28));
  place('rustle', T.receipt, 0.9);
  place('frown', T.receipt + 0.7, 0.8);
  place('punch', T.punch, 1);
  place('crack', T.punch + 0.03, 0.9);
  place('ring', T.ring, 0.8, T.answer);
  place('click', T.answer, 0.8);
  place(
    'talk',
    T.answer + 0.2,
    0.45,
    typing(
      '$14 on coffee?! Oh, I see. We got a f*@king millionaire over here!',
      T.answer + 0.2,
      26,
    ),
  );
  place('coin', T.end + 0.9 + 3 * BEAT, 0.5);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const data = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++)
    data.writeInt16LE(Math.round(((out[i] ?? 0) / peak) * 0.9 * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// --- Main ------------------------------------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  if (process.argv.includes('--stills')) {
    const times = [1.6, 3.2, 6.5, 9.6, 11.6, 13.0, 14.6, 15.4, 17.2, 19.9, 25.5];
    for (const t of times) {
      drawFrame(ctx, t);
      fs.writeFileSync(path.join(OUT, `still-${t.toFixed(1)}.png`), await canvas.encode('png'));
    }
    console.log(`Stills in ${OUT}`);
    return;
  }

  const audio = path.join(OUT, 'soundtrack.wav');
  fs.writeFileSync(audio, mix());
  const video = path.join(OUT, 'vinnie-promo.mp4');
  const ff = spawn(
    ffmpegPath as unknown as string,
    [
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${WIDTH}x${HEIGHT}`,
      '-r',
      String(FPS),
      '-i',
      '-',
      '-i',
      audio,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      video,
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] },
  );
  const frames = Math.round(DURATION * FPS);
  for (let f = 0; f < frames; f++) {
    drawFrame(ctx, f / FPS);
    const data = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise<void>((resolve, reject) =>
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))),
  );
  console.log(`Video: ${video}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
