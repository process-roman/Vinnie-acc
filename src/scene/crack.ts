// Procedural glass crack, drawn as pixel art: a crushed point of impact, jagged rays that
// thin out as they run, a spider's web between them and panes of glass catching the light.
// The whole crack is generated once per seed and each level reveals more of it, so
// escalation looks like the same crack spreading rather than a new one.

import { rng } from '@/domain/random';

import { blendPixel, createBuffer, hex, noise, PixelBuffer, Rgba, setPixel } from './pixels';

import type { CrackLevel } from '@/domain/repair';

export type { CrackLevel };
export type Segment = { x0: number; y0: number; x1: number; y1: number };
type Pt = { x: number; y: number };

const LEVELS: Record<Exclude<CrackLevel, 0>, { rays: number; reach: number; rings: number }> = {
  1: { rays: 6, reach: 0.13, rings: 0 },
  2: { rays: 11, reach: 0.42, rings: 3 },
  3: { rays: 18, reach: 1.2, rings: 5 },
};
const MAX_RAYS = 18;
/** Where the web's rings sit, as a share of the screen's diagonal. */
const RINGS = [0.035, 0.07, 0.12, 0.19, 0.29];
/** Ray order: the first few spread around the impact, so level 1 isn't lopsided. */
const ORDER = [0, 9, 4, 13, 6, 15, 2, 11, 7, 16, 3, 12, 1, 10, 5, 14, 8, 17];

function polyline(points: Pt[], maxLen: number): Segment[] {
  const out: Segment[] = [];
  let left = maxLen;
  for (let i = 1; i < points.length && left > 0; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = Math.min(1, left / len);
    out.push({ x0: a.x, y0: a.y, x1: a.x + (b.x - a.x) * t, y1: a.y + (b.y - a.y) * t });
    left -= len;
  }
  return out;
}

function walk(rand: () => number, from: Pt, angle: number, length: number, step: number): Pt[] {
  const pts = [from];
  let { x, y } = from;
  let a = angle;
  for (let d = 0; d < length; d += step) {
    // Glass breaks in straight runs with sudden kinks, not in curves.
    a += rand() < 0.3 ? (rand() - 0.5) * 1.3 : (rand() - 0.5) * 0.15;
    // Pull back toward the ray's main direction so it doesn't curl.
    a += (angle - a) * 0.35;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push({ x, y });
  }
  return pts;
}

type Shard = { points: Pt[]; tint: Rgba };

type Crack = { segments: Segment[]; shards: Shard[] };

function buildCrack(
  level: Exclude<CrackLevel, 0>,
  w: number,
  h: number,
  seed: number,
  impact: Pt,
): Crack {
  const rand = rng(seed);
  const diag = Math.hypot(w, h);
  const step = diag * 0.022;

  // Generate everything up front in a fixed order, then reveal by level.
  const rays = Array.from({ length: MAX_RAYS }, (_, i) => {
    const angle = (i / MAX_RAYS) * Math.PI * 2 + (rand() - 0.5) * 0.28;
    const share = 0.55 + rand() * 0.45;
    const points = walk(rand, impact, angle, diag * share, step);
    const branches = [0, 1].map(() => ({
      at: 0.14 + rand() * 0.5,
      side: rand() < 0.5 ? -1 : 1,
      length: 0.07 + rand() * 0.11,
    }));
    return { angle, share, points, branches };
  });

  const cfg = LEVELS[level];
  const segments: Segment[] = [];
  const visible = ORDER.slice(0, cfg.rays).sort((a, b) => a - b);
  const reachOf = (idx: number) => diag * cfg.reach * rays[idx].share;

  for (const idx of ORDER.slice(0, cfg.rays)) {
    const ray = rays[idx];
    const reach = reachOf(idx);
    segments.push(...polyline(ray.points, reach));
    if (level === 1) continue;
    ray.branches.forEach((b, n) => {
      const start = diag * ray.share * b.at;
      if (reach <= start) return;
      const from = ray.points[Math.min(ray.points.length - 1, Math.round(start / step))];
      // Each branch has its own stream, so it doesn't shift when the level changes.
      const stream = rng(seed * 31 + idx * 7 + n + 1);
      const fork = walk(stream, from, ray.angle + b.side * 0.65, diag * b.length, step);
      segments.push(...polyline(fork, Math.min(diag * b.length, reach - start)));
    });
  }

  // The web: a chord across each pair of neighbouring rays, bowed in toward the impact,
  // and the pane of glass it closes off.
  const shards: Shard[] = [];
  const pointAt = (idx: number, r: number): Pt | null => {
    if (r * diag > reachOf(idx)) return null;
    const pts = rays[idx].points;
    return pts[Math.min(pts.length - 1, Math.round((r * diag) / step))];
  };
  RINGS.slice(0, cfg.rings).forEach((r, ring) => {
    visible.forEach((idx, i) => {
      const next = visible[(i + 1) % visible.length];
      const a = pointAt(idx, r);
      const b = pointAt(next, r);
      if (!a || !b) return;
      // A few chords are missing: real webs have gaps.
      const n = noise(seed + ring * 97, idx);
      if (level > 1 && n > 0.86) return;
      const mid = {
        x: impact.x + ((a.x + b.x) / 2 - impact.x) * (0.82 + n * 0.14),
        y: impact.y + ((a.y + b.y) / 2 - impact.y) * (0.82 + n * 0.14),
      };
      segments.push(...polyline([a, mid, b], Infinity));
      // Panes catch the light or fall into shadow; most stay clear so text stays readable.
      const inner = ring === 0 ? null : RINGS[ring - 1];
      const a0 = inner === null ? impact : pointAt(idx, inner);
      const b0 = inner === null ? impact : pointAt(next, inner);
      if (!a0 || !b0) return;
      const t = noise(seed + ring * 13, idx * 3 + 1);
      const fade = 1 - ring * 0.14;
      if (t < 0.4) {
        shards.push({
          points: [a0, a, mid, b, b0],
          tint: [255, 255, 255, Math.round((18 + t * 90) * fade)],
        });
      } else if (t > 0.76) {
        shards.push({
          points: [a0, a, mid, b, b0],
          tint: [18, 24, 34, Math.round((22 + (t - 0.76) * 110) * fade)],
        });
      }
    });
  });
  return { segments, shards };
}

const defaultImpact = (w: number, h: number): Pt => ({ x: w / 2, y: h * 0.4 });

/**
 * Line segments for a crack at the given level, in pixel coordinates of a
 * w x h buffer. Same seed + impact gives the same crack at every level.
 */
export function generateCrack(
  level: CrackLevel,
  w: number,
  h: number,
  seed: number,
  impact: Pt = defaultImpact(w, h),
): Segment[] {
  if (level === 0) return [];
  return buildCrack(level, w, h, seed, impact).segments;
}

function inPolygon(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function fillShard(buf: PixelBuffer, { points, tint }: Shard): void {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(buf.width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(buf.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inPolygon(x + 0.5, y + 0.5, points)) blendPixel(buf, x, y, tint);
    }
  }
}

/** Calls `fn` for each pixel of a line (Bresenham), with how far along it is (0..1). */
function eachLinePixel(s: Segment, fn: (x: number, y: number) => void): void {
  let x = Math.round(s.x0);
  let y = Math.round(s.y0);
  const x1 = Math.round(s.x1);
  const y1 = Math.round(s.y1);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    fn(x, y);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

const CRACK_SHADOW = hex('#10141c', 130);
const CRACK_GLINT = hex('#ffffff', 70);
const WHITE = hex('#ffffff');
const CRUSHED_DARK = hex('#10141c', 110);

export function rasterizeCrack(
  level: CrackLevel,
  w: number,
  h: number,
  seed: number,
  impact: Pt = defaultImpact(w, h),
): PixelBuffer {
  const buf = createBuffer(w, h);
  if (level === 0) return buf;
  const { segments, shards } = buildCrack(level, w, h, seed, impact);
  const diag = Math.hypot(w, h);
  for (const s of shards) fillShard(buf, s);

  // Each line: a shadow to one side so it looks cut into the glass, a glint on the other,
  // and a white core that's thick and solid at the impact and thins out to a hairline.
  for (const s of segments) {
    eachLinePixel(s, (x, y) => {
      blendPixel(buf, x + 1, y + 1, CRACK_SHADOW);
      blendPixel(buf, x - 1, y, CRACK_GLINT);
    });
  }
  for (const s of segments) {
    eachLinePixel(s, (x, y) => {
      const d = Math.hypot(x - impact.x, y - impact.y) / diag;
      setPixel(
        buf,
        x,
        y,
        d < 0.3 ? WHITE : [255, 255, 255, Math.round(Math.max(120, 255 - (d - 0.3) * 360))],
      );
      if (d < 0.06) setPixel(buf, x + 1, y, WHITE);
      if (d < 0.03) setPixel(buf, x, y + 1, WHITE);
    });
  }

  // The point of impact: a crushed, irregular patch of white.
  const crater = diag * (0.012 + level * 0.005);
  const cx = Math.round(impact.x);
  const cy = Math.round(impact.y);
  const span = Math.ceil(crater * 1.4);
  for (let y = cy - span; y <= cy + span; y++) {
    for (let x = cx - span; x <= cx + span; x++) {
      const angle = Math.atan2(y - cy, x - cx);
      const edge = crater * (0.75 + 0.5 * noise(seed, Math.floor((angle + Math.PI) * 3)));
      if (Math.hypot(x - cx, y - cy) > edge) continue;
      const n = noise(x * 3 + seed, y * 5);
      if (n > 0.62) setPixel(buf, x, y, WHITE);
      else if (n > 0.3) blendPixel(buf, x, y, [255, 255, 255, 150]);
      else blendPixel(buf, x, y, CRUSHED_DARK);
    }
  }

  // Slivers thrown out from it.
  const rand = rng(seed + 7);
  for (let i = 0; i < level * 22; i++) {
    const a = rand() * Math.PI * 2;
    const r = crater + Math.pow(rand(), 2) * diag * (0.03 + level * 0.02);
    const x = Math.round(impact.x + Math.cos(a) * r);
    const y = Math.round(impact.y + Math.sin(a) * r);
    setPixel(buf, x, y, WHITE);
    if (rand() < 0.4) blendPixel(buf, x + 1, y + 1, CRACK_SHADOW);
  }
  return buf;
}
