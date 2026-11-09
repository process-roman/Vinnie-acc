// An original crime-caper groove for the promo: a strutting bassline, a breakbeat, choppy
// guitar and brass stabs, in D minor at 116 bpm. Synthesized here, so it's ours to use.
// It plays under the intro, cuts dead when the receipt lands, and comes back for the end card.

import { BAR, BEAT, T } from './timeline';

export const RATE = 32000;
const TAU = Math.PI * 2;

function noiseSource(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

const note = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const decay = (t: number, rate: number) => Math.exp(-t * rate);

function render(duration: number, fn: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round(duration * RATE));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE);
  return out;
}

function lowPass(samples: Float32Array, amount: number): Float32Array {
  let y = 0;
  return samples.map((x) => (y += amount * (x - y)));
}

function add(into: Float32Array, sound: Float32Array, at: number, gain: number): void {
  const start = Math.round(at * RATE);
  for (let i = 0; i < sound.length && start + i < into.length; i++) {
    if (start + i >= 0) into[start + i] += sound[i] * gain;
  }
}

// --- Drums ---------------------------------------------------------------------------

const kick = () => render(0.32, (t) => Math.sin(TAU * (48 + 110 * decay(t, 28)) * t) * decay(t, 9));

function snare(): Float32Array {
  const n = noiseSource(3);
  const body = render(0.22, (t) => Math.sin(TAU * 190 * t) * decay(t, 30));
  const rattle = lowPass(
    render(0.22, (t) => n() * decay(t, 16)),
    0.55,
  );
  return body.map((v, i) => v * 0.5 + rattle[i] * 0.6);
}

function hat(open = false): Float32Array {
  const n = noiseSource(open ? 5 : 7);
  const raw = render(open ? 0.18 : 0.05, (t) => n() * decay(t, open ? 18 : 70));
  const dull = lowPass(raw, 0.3);
  return raw.map((v, i) => v - dull[i]);
}

// --- Instruments -----------------------------------------------------------------------

/** A round, punchy electric bass. */
function bass(midi: number, length: number): Float32Array {
  const f = note(midi);
  const raw = render(length, (t) => {
    const saw = ((f * t) % 1) * 2 - 1;
    const env = Math.min(1, t * 300) * (t > length - 0.03 ? (length - t) / 0.03 : 1);
    return (Math.sin(TAU * f * t) * 0.8 + saw * 0.25) * env * decay(t, 2.5);
  });
  return lowPass(raw, 0.08);
}

/** A choppy, muted guitar chord on the offbeat: the "chk". */
function chank(midis: number[]): Float32Array {
  const n = noiseSource(midis[0]);
  const raw = render(0.09, (t) => {
    let v = 0;
    for (const m of midis) v += (((note(m) * t) % 1) * 2 - 1) * 0.3;
    return (v + n() * 0.15) * decay(t, 40);
  });
  return lowPass(raw, 0.35);
}

/** A brass section stab: a stacked chord of buzzy horns, bright then backing off. */
function stab(midis: number[], length = 0.32): Float32Array {
  const raw = render(length, (t) => {
    let v = 0;
    for (const m of midis) {
      const f = note(m) * (1 + Math.sin(TAU * 6 * t) * 0.004);
      v += (((f * t) % 1) * 2 - 1) * 0.25 + (((f * 1.004 * t) % 1) * 2 - 1) * 0.15;
    }
    const swell = Math.min(1, t * 60);
    const fall = t > length - 0.06 ? Math.max(0, (length - t) / 0.06) : 1;
    return v * swell * fall * (0.6 + 0.4 * decay(t, 6));
  });
  // A filter that opens on the attack, like a real horn.
  let y = 0;
  return raw.map((x, i) => (y += (0.12 + 0.3 * decay(i / RATE, 9)) * (x - y)));
}

// D minor: the bass riff, one bar of sixteenths. Each entry is [sixteenth, midi, length in sixteenths].
const RIFF: [number, number, number][] = [
  [0, 38, 2],
  [3, 38, 1],
  [4, 41, 2],
  [6, 43, 1],
  [8, 45, 2],
  [10, 43, 1],
  [11, 41, 1],
  [12, 38, 2],
  [14, 36, 1],
  [15, 37, 1],
];
const DM7 = [62, 65, 69, 72];
const BB = [58, 62, 65, 70];
const A7 = [57, 61, 64, 67];

type Part = 'drums' | 'bass' | 'guitar';

function bar(into: Float32Array, at: number, parts: Part[], fill = false): void {
  const s16 = BEAT / 4;
  // Swing the offbeat sixteenths a touch: it struts instead of marching.
  const time = (i: number) => at + i * s16 + (i % 2 === 1 ? s16 * 0.18 : 0);
  if (parts.includes('drums')) {
    for (const i of [0, 7, 10]) add(into, kick(), time(i), 0.9);
    for (const i of [4, 12]) add(into, snare(), time(i), 0.6);
    for (let i = 0; i < 16; i += 2) add(into, hat(i === 14), time(i), i % 4 === 0 ? 0.3 : 0.2);
    if (fill) for (const i of [13, 14, 15]) add(into, snare(), time(i), 0.35 + i * 0.01);
  }
  if (parts.includes('bass')) {
    for (const [i, m, len] of RIFF) add(into, bass(m, len * s16 * 0.9), time(i), 0.55);
  }
  if (parts.includes('guitar')) {
    for (const i of [2, 6, 10, 14]) add(into, chank(i < 8 ? DM7 : BB), time(i), 0.22);
  }
}

export function composeMusic(duration: number): Float32Array {
  const out = new Float32Array(Math.round(duration * RATE));
  const all: Part[] = ['drums', 'bass', 'guitar'];

  // Intro: straight into the groove under "Heard you need a finance guy."
  bar(out, T.open, ['drums', 'bass']);
  // Vinnie's card: a horn hit on the freeze.
  add(out, stab(DM7, 0.5), T.vinnieCard, 0.5);
  bar(out, T.vinnieCard, all);
  bar(out, T.rule, all);
  bar(out, T.rule + BAR, all);
  add(out, stab(BB), T.rule + BAR + BEAT * 3.5, 0.35);
  // Luc's card: another hit.
  add(out, stab(A7, 0.45), T.lucCard, 0.5);
  bar(out, T.lucCard, all);
  // The warning: horns climbing, a drum fill, then nothing.
  bar(out, T.warning, all, true);
  add(out, stab(BB, 0.2), T.warning + BEAT * 2, 0.35);
  add(out, stab(A7, 0.2), T.warning + BEAT * 3, 0.4);
  // (Silence from the receipt to the end card: the scene has the floor.)

  // End card: back in, two bars and a held chord.
  add(out, stab(DM7, 0.6), T.end, 0.55);
  bar(out, T.end, all);
  bar(out, T.end + BAR, all);
  add(out, stab([50, 62, 65, 69, 74], 1.4), T.end + BAR * 2, 0.55);
  add(out, kick(), T.end + BAR * 2, 0.9);

  // Hard stop where the receipt lands, so the silence is clean.
  const cut = Math.round(T.receipt * RATE);
  const back = Math.round(T.end * RATE) - 40;
  for (let i = cut; i < back && i < out.length; i++) out[i] = 0;
  // Fade the final chord out at the very end.
  const fadeFrom = out.length - Math.round(0.6 * RATE);
  for (let i = fadeFrom; i < out.length; i++) out[i] *= (out.length - i) / (out.length - fadeFrom);
  return out;
}
