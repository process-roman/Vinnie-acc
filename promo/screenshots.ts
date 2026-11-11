// Store screenshots, drawn from the game's own art: a title, and the app on a phone.
// Writes App Store (1320x2868, the 6.9" size) and Google Play (1080x1920) PNGs.
// Run with: npm run screenshots

import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

import type { RoomState } from '../src/domain/roomState';
import { composeSnapshot } from '../src/scene/composition';
import { rasterizeCrack } from '../src/scene/crack';
import { GridPoint, gridToScreen } from '../src/scene/iso';
import { ROOM_ORIGIN, ROOM_W, WAYPOINTS } from '../src/scene/room';
import { buildDusk } from '../src/scene/sprites/dusk';
import { CAT_RUN_H, CAT_RUN_SHEET, CAT_RUN_W } from '../src/scene/sprites/props';
import { VINNIE_ANCHOR } from '../src/scene/sprites/vinnie';
import { bubble, C, pixels, roundRect } from './draw';

const OUT = path.join(__dirname, 'out', 'screenshots');

// --- The phone screen: the app, drawn at 1080 x 2340 -----------------------------------

const SW = 1080;
const SH = 2340;
const OFFICE_SCALE = 4;
const OFFICE_X = (SW - ROOM_W * OFFICE_SCALE) / 2;
const OFFICE_Y = 560;

type Mood = { lit: number; label: string; color: string };
type Budget = { spent: string; share: number };
/** fx/fy: the office point to look at; cy: where it lands on screen, as a share of the height. */
type Camera = { fx: number; fy: number; zoom: number; cy?: number };

function headAt(at: GridPoint): { x: number; y: number } {
  const feet = gridToScreen(at, ROOM_ORIGIN);
  return {
    x: OFFICE_X + feet.x * OFFICE_SCALE,
    y: OFFICE_Y + (Math.round(feet.y) - VINNIE_ANCHOR.y + 4) * OFFICE_SCALE,
  };
}

const gridOnScreen = (p: GridPoint, lift = 0) => {
  const s = gridToScreen(p, ROOM_ORIGIN);
  return { x: OFFICE_X + s.x * OFFICE_SCALE, y: OFFICE_Y + (s.y - lift) * OFFICE_SCALE };
};

const throughCamera = (p: { x: number; y: number }, cam: Camera) => ({
  x: SW / 2 + (p.x - cam.fx) * cam.zoom,
  y: SH * (cam.cy ?? 0.5) + (p.y - cam.fy) * cam.zoom,
});

function chrome(ctx: SKRSContext2D, mood: Mood, budget: Budget, status: string): void {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, SW, SH);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Phone status bar.
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 40px Inter';
  ctx.fillText('9:41', 90, 92);
  // Header.
  ctx.fillStyle = C.brick;
  ctx.font = 'bold 76px Inter';
  ctx.fillText('Vinnie', 56, 250);
  ctx.fillStyle = C.inkSoft;
  ctx.font = '32px Inter';
  ctx.fillText('November · Classic', 58, 300);
  ctx.fillStyle = C.card;
  roundRect(ctx, 650, 170, 374, 170, 28);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = C.inkSoft;
  ctx.font = '26px Inter';
  ctx.fillText('This month', 990, 220);
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 60px Inter';
  ctx.fillText(budget.spent, 990, 280);
  ctx.fillStyle = C.inkSoft;
  ctx.font = '26px Inter';
  ctx.fillText('of $2,000', 990, 316);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.line;
  roundRect(ctx, 680, 328, 310, 8, 4);
  ctx.fill();
  ctx.fillStyle = budget.share > 0.85 ? C.red : C.good;
  roundRect(ctx, 680, 328, 310 * Math.min(1, budget.share), 8, 4);
  ctx.fill();
  // Mood bar.
  ctx.fillStyle = C.card;
  roundRect(ctx, 40, 370, 1000, 84, 42);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 30px Inter';
  ctx.fillText('Mood', 80, 423);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < mood.lit ? mood.color : C.line;
    roundRect(ctx, 190 + i * 54, 398, 46, 26, 6);
    ctx.fill();
  }
  ctx.fillStyle = mood.color;
  ctx.fillText(mood.label, 860, 423);
  // Status and the bottom bar.
  ctx.fillStyle = C.inkSoft;
  ctx.font = '34px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(status, SW / 2, 1830);
  ctx.fillStyle = C.mustardDark;
  roundRect(ctx, 290, 2020, 500, 124, 62);
  ctx.fill();
  ctx.fillStyle = C.mustard;
  roundRect(ctx, 290, 2012, 500, 120, 60);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 46px Inter';
  ctx.fillText('+ New Receipt', SW / 2, 2088);
  ctx.font = 'bold 34px Inter';
  ctx.fillText('History', 140, 2085);
  ctx.fillText('Budget', 940, 2085);
  ctx.textAlign = 'left';
}

type Scene = {
  room: RoomState;
  frame: number;
  at: GridPoint;
  mood: Mood;
  budget: Budget;
  status: string;
  camera?: Camera;
  /** Drawn in office coordinates, under the camera, after the office. */
  extra?: (ctx: SKRSContext2D) => void;
};

function appScreen(ctx: SKRSContext2D, s: Scene): void {
  const cam = s.camera ?? { fx: SW / 2, fy: SH / 2, zoom: 1 };
  ctx.save();
  ctx.translate(SW / 2, SH * (cam.cy ?? 0.5));
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.fx, -cam.fy);
  chrome(ctx, s.mood, s.budget, s.status);
  const office = composeSnapshot({
    room: s.room,
    cosmetics: {},
    vinnieFrame: s.frame,
    at: s.at,
    crackLevel: 0,
    crackSeed: 1,
  });
  pixels(ctx, office, OFFICE_X, OFFICE_Y, OFFICE_SCALE);
  s.extra?.(ctx);
  ctx.restore();
}

const ANGRY: Mood = { lit: 2, label: 'Angry', color: C.red };
const PROUD: Mood = { lit: 12, label: 'Proud', color: C.good };
const RELAXED: Mood = { lit: 8, label: 'Relaxed', color: C.mustardDark };

const CALM_ROOM: RoomState = {
  plant: 'healthy',
  weather: 'sunny',
  poster: 'intact',
  receipts: 3,
  espressoSteaming: true,
  cat: 'sleeping',
  streak: 4,
};

// --- The five screens ----------------------------------------------------------------

/** 1. The hero: Vinnie losing it over sneakers, and Luc not impressed. */
function heroScreen(ctx: SKRSContext2D): void {
  const at = { gx: 5.4, gy: 3.0 };
  const head = headAt(at);
  const feet = gridOnScreen(at);
  const cat = gridOnScreen({ gx: 6.9, gy: 3.4 });
  const cam = { fx: (head.x + cat.x) / 2, fy: (head.y + feet.y) / 2, zoom: 2.7, cy: 0.5 };
  appScreen(ctx, {
    room: {
      ...CALM_ROOM,
      plant: 'wilted',
      weather: 'storm',
      poster: 'cracked',
      espressoSteaming: false,
      cat: 'sitting',
    },
    frame: 9,
    at,
    mood: ANGRY,
    budget: { spent: '$1,960', share: 0.98 },
    status: 'Vinnie is fuming.',
    camera: cam,
  });
  bubble(
    ctx,
    '$900 on SNEAKERS?!\nMa sei pazzo?',
    '$900 on SNEAKERS?!\nMa sei pazzo?',
    throughCamera(head, cam),
    62,
    SW,
  );
}

/** 2. His limits, per category, and the one you broke. */
function limitsScreen(ctx: SKRSContext2D): void {
  const at = WAYPOINTS.desk;
  appScreen(ctx, {
    room: { ...CALM_ROOM, plant: 'droopy', weather: 'cloudy' },
    frame: 10,
    at,
    mood: { lit: 4, label: 'Suspicious', color: C.mustardDark },
    budget: { spent: '$1,240', share: 0.62 },
    status: '',
  });
  // The budget sheet, sliding up over the office.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, SW, SH);
  const top = 1240;
  ctx.fillStyle = C.card;
  roundRect(ctx, 0, top, SW, SH - top + 60, 48);
  ctx.fill();
  ctx.fillStyle = C.line;
  roundRect(ctx, SW / 2 - 44, top + 22, 88, 10, 5);
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 54px Inter';
  ctx.fillText('Where Vinnie loses it', 60, top + 130);
  ctx.fillStyle = C.inkSoft;
  ctx.font = '32px Inter';
  ctx.fillText('One purchase over the line, and he has words.', 60, top + 185);
  const rows: [string, string, string, string, boolean][] = [
    ['Groceries', '#4E9F5A', 'Your number', '$200', false],
    ['Coffee', '#8A5A3B', 'You went $14', '$8', true],
    ['Dining Out', '#D9822B', "Vinnie's call", '$60', false],
    ['Delivery', '#E05B3A', "Vinnie's call", '$40', false],
    ['Shopping', '#9B59B6', 'Your number', '$120', false],
  ];
  rows.forEach(([label, color, sub, amount, over], i) => {
    const y = top + 240 + i * 140;
    if (over) {
      ctx.fillStyle = '#F8DDD6';
      roundRect(ctx, 30, y - 10, SW - 60, 130, 20);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(90, y + 55, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 44px Inter';
    ctx.fillText(label, 130, y + 50);
    ctx.fillStyle = over ? C.red : C.inkSoft;
    ctx.font = `${over ? 'bold ' : ''}30px Inter`;
    ctx.fillText(sub, 130, y + 95);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 48px Inter';
    ctx.fillText(amount, SW - 70, y + 70);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.line;
    ctx.fillRect(60, y + 128, SW - 120, 2);
  });
  bubble(
    ctx,
    'My line for coffee is $8.\nYou went $14.',
    'My line for coffee is $8.\nYou went $14.',
    headAt(at),
    54,
    SW,
  );
}

/** 3. The good side: under budget, and he's proud. */
function habitsScreen(ctx: SKRSContext2D): void {
  const at = WAYPOINTS.desk;
  appScreen(ctx, {
    room: CALM_ROOM,
    frame: 7,
    at,
    mood: PROUD,
    budget: { spent: '$612', share: 0.31 },
    status: 'Vinnie approves.',
  });
  const line = 'Under budget. Look at you, making my blood pressure somebody else’s problem.';
  bubble(ctx, line, line, headAt(at), 52, SW);
}

/** 4. Luc, mid-sprint, with Vinnie warning you off. */
function lucScreen(ctx: SKRSContext2D): void {
  const at = { gx: 3.4, gy: 3.9 };
  const catAt = { gx: 4.8, gy: 4.9 };
  const cat = gridOnScreen(catAt);
  const head = headAt(at);
  const cam = { fx: (head.x + cat.x) / 2 - 10, fy: (head.y + cat.y) / 2, zoom: 3, cy: 0.6 };
  appScreen(ctx, {
    room: { ...CALM_ROOM, cat: 'hiding' },
    frame: 9,
    at,
    mood: { lit: 5, label: 'Suspicious', color: C.mustardDark },
    budget: { spent: '$880', share: 0.44 },
    status: 'Luc is running laps.',
    camera: cam,
    extra: (c) => {
      // Luc at full tilt, with speed lines behind him.
      const s = OFFICE_SCALE;
      const x = cat.x - (CAT_RUN_W / 2) * s;
      const y = cat.y - CAT_RUN_H * s;
      c.fillStyle = C.ink;
      for (const [dx, dy, len] of [
        [-14, 3, 9],
        [-18, 7, 12],
        [-12, 11, 7],
      ]) {
        c.fillRect(x + dx * s, y + dy * s, len * s, s);
      }
      pixels(c, CAT_RUN_SHEET, x, y, s, CAT_RUN_W, CAT_RUN_W);
    },
  });
  const line = 'Touch Luc again and I introduce you to the fishes.';
  bubble(ctx, line, line, throughCamera(head, cam), 56, SW);
}

/** 5. Private: nothing leaves the phone. */
function privateScreen(ctx: SKRSContext2D): void {
  const at = WAYPOINTS.chair;
  appScreen(ctx, {
    room: CALM_ROOM,
    frame: 4,
    at,
    mood: RELAXED,
    budget: { spent: '$618', share: 0.31 },
    status: 'Vinnie is doing your taxes.',
  });
  const line = "Your numbers stay right here. I don't share. I don't snitch.";
  bubble(ctx, line, line, headAt(at), 54, SW);
}

// --- Store frame: background, title, phone -------------------------------------------

type Background = 'hero' | 'yellow' | 'green' | 'peach' | 'dusk';
type Shot = {
  name: string;
  title: { text: string; accent?: boolean }[];
  background: Background;
  screen: (ctx: SKRSContext2D) => void;
};

const SHOTS: Shot[] = [
  {
    name: '1-yells',
    title: [{ text: 'The budget app that' }, { text: 'yells at you', accent: true }],
    background: 'hero',
    screen: heroScreen,
  },
  {
    name: '2-limits',
    title: [{ text: 'Set your limits.' }, { text: 'Vinnie enforces them.', accent: true }],
    background: 'yellow',
    screen: limitsScreen,
  },
  {
    name: '3-habits',
    title: [{ text: 'Break your' }, { text: 'bad spending habits', accent: true }],
    background: 'green',
    screen: habitsScreen,
  },
  {
    name: '4-luc',
    title: [{ text: 'Don’t poke' }, { text: 'Luc.', accent: true }],
    background: 'peach',
    screen: lucScreen,
  },
  {
    name: '5-private',
    title: [{ text: 'No bank login.' }, { text: 'Your data stays on your phone.', accent: true }],
    background: 'dusk',
    screen: privateScreen,
  },
];

const PALETTE: Record<Background, { bg: string; text: string; accent: string }> = {
  hero: { bg: '#A8321F', text: '#FFF6E2', accent: '#F6C431' },
  yellow: { bg: '#F3E2AE', text: C.ink, accent: C.red },
  green: { bg: '#D6E8CC', text: C.ink, accent: '#2F7A45' },
  peach: { bg: '#F6D5C2', text: C.ink, accent: C.red },
  dusk: { bg: '#2D2350', text: '#FFF6E2', accent: '#F6C431' },
};

const dusk = buildDusk();
const heroCrack = rasterizeCrack(3, 330, 717, 21, { x: 260, y: 120 });

function background(ctx: SKRSContext2D, kind: Background, w: number, h: number): void {
  ctx.fillStyle = PALETTE[kind].bg;
  ctx.fillRect(0, 0, w, h);
  if (kind === 'dusk') {
    // The opening scene's Brooklyn sunset, scaled to cover.
    const scale = Math.ceil(Math.max(w / dusk.width, h / dusk.height));
    pixels(ctx, dusk, (w - dusk.width * scale) / 2, h - dusk.height * scale, scale);
    ctx.fillStyle = 'rgba(20, 14, 40, 0.35)';
    ctx.fillRect(0, 0, w, h);
    // Darker behind the title, so the stars don't fight it.
    const shade = ctx.createLinearGradient(0, 0, 0, h * 0.2);
    shade.addColorStop(0, 'rgba(20, 14, 40, 0.6)');
    shade.addColorStop(1, 'rgba(20, 14, 40, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h * 0.2);
  }
  if (kind === 'hero') {
    // A shattered pane behind everything, faint.
    ctx.globalAlpha = 0.18;
    pixels(ctx, heroCrack, 0, 0, w / heroCrack.width);
    ctx.globalAlpha = 1;
  }
}

/** The title, centred, with the accent words in their own colour. */
function title(ctx: SKRSContext2D, shot: Shot, w: number, top: number): number {
  const colors = PALETTE[shot.background];
  const maxW = w * 0.88;
  // A short title stays on one line. Otherwise each part gets its own line: shrink a little so
  // the parts fit, and if one still can't, keep the full size and wrap it into balanced lines.
  let size = Math.round(w * 0.085);
  ctx.font = `bold ${size}px Inter`;
  const oneLine = ctx.measureText(shot.title.map((part) => part.text).join(' ')).width <= maxW;
  const widest = Math.max(...shot.title.map((part) => ctx.measureText(part.text).width));
  if (widest * 0.75 <= maxW) size = Math.round(Math.min(size, (size * maxW) / widest));
  ctx.font = `bold ${size}px Inter`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Lay words out into lines, keeping each word's colour.
  const words = shot.title.flatMap((part) =>
    part.text.split(' ').map((word, i) => ({ word, accent: !!part.accent, starts: i === 0 })),
  );
  const widthOf = (ws: typeof words) => ctx.measureText(ws.map((x) => x.word).join(' ')).width;
  const layout = (limit: number) => {
    const out: (typeof words)[] = [];
    let line: typeof words = [];
    for (const word of words) {
      if (line.length && ((word.starts && !oneLine) || widthOf([...line, word]) > limit)) {
        out.push(line);
        line = [];
      }
      line.push(word);
    }
    out.push(line);
    return out;
  };
  // Narrow the measure while the line count holds, so wrapped lines come out even.
  let lines = layout(maxW);
  for (let limit = maxW - 10; limit > maxW / 2; limit -= 10) {
    const tighter = layout(limit);
    if (tighter.length > lines.length) break;
    lines = tighter;
  }
  const lineH = size * 1.12;
  lines.forEach((ws, i) => {
    let x = (w - widthOf(ws)) / 2;
    const y = top + size + i * lineH;
    ws.forEach((word, j) => {
      ctx.fillStyle = word.accent ? colors.accent : colors.text;
      const text = j < ws.length - 1 ? `${word.word} ` : word.word;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    });
  });
  return top + size + (lines.length - 1) * lineH + size * 0.35;
}

function phone(
  ctx: SKRSContext2D,
  shot: Shot,
  x: number,
  y: number,
  screenW: number,
  tilt = 0,
): void {
  const scale = screenW / SW;
  const screenH = SH * scale;
  const bezel = screenW * 0.025;
  const screen = createCanvas(SW, SH);
  shot.screen(screen.getContext('2d'));
  ctx.save();
  ctx.translate(x + screenW / 2, y + screenH / 2);
  ctx.rotate(tilt);
  ctx.translate(-screenW / 2, -screenH / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = screenW * 0.06;
  ctx.shadowOffsetY = screenW * 0.03;
  ctx.fillStyle = '#121214';
  roundRect(ctx, -bezel, -bezel, screenW + bezel * 2, screenH + bezel * 2, screenW * 0.13);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  roundRect(ctx, 0, 0, screenW, screenH, screenW * 0.11);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(screen, 0, 0, screenW, screenH);
  ctx.restore();
  // The camera island.
  ctx.fillStyle = '#121214';
  roundRect(
    ctx,
    screenW / 2 - screenW * 0.15,
    screenW * 0.03,
    screenW * 0.3,
    screenW * 0.085,
    screenW * 0.04,
  );
  ctx.fill();
  ctx.restore();
}

function render(shot: Shot, w: number, h: number): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  background(ctx, shot.background, w, h);
  const titleBottom = title(ctx, shot, w, h * 0.055);
  const hero = shot.background === 'hero';
  // The phone takes the rest of the height, and the hero runs off the bottom edge.
  const top = titleBottom + h * 0.035;
  const room = (hero ? h * 1.04 : h * 0.965) - top;
  const screenW = Math.min(w * (hero ? 0.86 : 0.76), room / (SH / SW + 0.05));
  phone(ctx, shot, (w - screenW) / 2, top + screenW * 0.025, screenW, hero ? -0.035 : 0);
  return canvas.toBuffer('image/png');
}

const SIZES = [
  { store: 'appstore', w: 1320, h: 2868 },
  { store: 'play', w: 1080, h: 1920 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const shot of SHOTS) {
  for (const size of SIZES) {
    fs.writeFileSync(
      path.join(OUT, `${size.store}-${shot.name}.png`),
      render(shot, size.w, size.h),
    );
  }
}
console.log(`Screenshots in ${OUT}`);
