// Procedural glass crack, drawn as pixel art. The full crack is generated once
// per seed and each level reveals more of it, so escalation looks like the same
// crack spreading rather than a new one.

import { createBuffer, drawLine, hex, PixelBuffer, setPixel } from './pixels';

export type CrackLevel = 0 | 1 | 2 | 3;
export type Segment = { x0: number; y0: number; x1: number; y1: number };
type Pt = { x: number; y: number };

const LEVELS: Record<Exclude<CrackLevel, 0>, { rays: number; reach: number; rings: number }> = {
  1: { rays: 4, reach: 0.18, rings: 0 },
  2: { rays: 7, reach: 0.45, rings: 1 },
  3: { rays: 12, reach: 1.2, rings: 2 },
};
const MAX_RAYS = 12;

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
    a += (rand() - 0.5) * 0.7;
    // Pull back toward the ray's main direction so it doesn't curl.
    a += (angle - a) * 0.4;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Line segments for a crack at the given level, in pixel coordinates of a
 * w x h buffer. Same seed + impact gives the same crack at every level.
 */
export function generateCrack(
  level: CrackLevel,
  w: number,
  h: number,
  seed: number,
  impact: Pt = { x: w / 2, y: h * 0.4 },
): Segment[] {
  if (level === 0) return [];
  const rand = rng(seed);
  const diag = Math.hypot(w, h);
  const step = diag * 0.035;

  // Generate everything up front in a fixed order, then reveal by level.
  const rays = Array.from({ length: MAX_RAYS }, (_, i) => {
    const angle = (i / MAX_RAYS) * Math.PI * 2 + (rand() - 0.5) * 0.45;
    const share = 0.6 + rand() * 0.4;
    const points = walk(rand, impact, angle, diag * share, step);
    const branchAt = 0.25 + rand() * 0.4;
    const branchSide = rand() < 0.5 ? -1 : 1;
    return { angle, share, points, branchAt, branchSide };
  });
  // Ray order is shuffled so the first few rays at level 1 spread around the impact.
  const order = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
  const rings = [0.035, 0.085].map((r) =>
    Array.from({ length: 11 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const rr = diag * r * (0.8 + rand() * 0.4);
      return { x: impact.x + Math.cos(a) * rr, y: impact.y + Math.sin(a) * rr };
    }),
  );

  const cfg = LEVELS[level];
  const segments: Segment[] = [];
  for (const idx of order.slice(0, cfg.rays)) {
    const ray = rays[idx];
    const visible = diag * cfg.reach * ray.share;
    segments.push(...polyline(ray.points, visible));
    const branchStart = diag * ray.share * ray.branchAt;
    if (level >= 2 && visible > branchStart) {
      const k = Math.min(ray.points.length - 1, Math.round(branchStart / step));
      const from = ray.points[k];
      const branch = walk(
        branchRand(seed, idx),
        from,
        ray.angle + ray.branchSide * 0.7,
        diag * 0.12,
        step,
      );
      segments.push(...polyline(branch, Math.min(diag * 0.12, visible - branchStart)));
    }
  }
  for (const ring of rings.slice(0, cfg.rings)) {
    segments.push(...polyline(ring, Infinity));
  }
  return segments;
}

/** Independent stream per branch so branches don't shift when the level changes. */
function branchRand(seed: number, idx: number): () => number {
  return rng(seed * 31 + idx + 1);
}

const CRACK_LINE = hex('#ffffff', 235);
const CRACK_SHADOW = hex('#1b1410', 110);
const SHARD = hex('#ffffff', 60);

export function rasterizeCrack(
  level: CrackLevel,
  w: number,
  h: number,
  seed: number,
  impact?: Pt,
): PixelBuffer {
  const buf = createBuffer(w, h);
  const segs = generateCrack(level, w, h, seed, impact);
  for (const s of segs) drawLine(buf, s.x0 + 1, s.y0 + 1, s.x1 + 1, s.y1 + 1, CRACK_SHADOW);
  for (const s of segs) drawLine(buf, s.x0, s.y0, s.x1, s.y1, CRACK_LINE);
  if (level === 3) {
    // A pale, shattered patch around the impact.
    const c = impact ?? { x: w / 2, y: h * 0.4 };
    const rand = rng(seed + 7);
    for (let i = 0; i < 140; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * Math.hypot(w, h) * 0.03;
      setPixel(buf, Math.round(c.x + Math.cos(a) * r), Math.round(c.y + Math.sin(a) * r), SHARD);
    }
  }
  return buf;
}
