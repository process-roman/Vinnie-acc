// Generates the game's retro sound effects as small WAV files in assets/sounds.
/* global Buffer */
// Every sound is synthesized here from waveforms and seeded noise, so they're ours to use
// and easy to tweak. Run with: npm run sounds

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

// Seeded, so running this again gives identical files.
function noiseSource(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);
const saw = (phase) => (phase % 1) * 2 - 1;
const sine = (phase) => Math.sin(phase * Math.PI * 2);
const seconds = (t) => Math.round(t * RATE);

/** Renders `fn(t, i)` for a number of seconds. */
function render(duration, fn) {
  const out = new Float32Array(seconds(duration));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE, i);
  return out;
}

/** Adds `b` into `a` starting at time `at`. */
function mixIn(a, b, at = 0, gain = 1) {
  const start = seconds(at);
  for (let i = 0; i < b.length && start + i < a.length; i++) a[start + i] += b[i] * gain;
  return a;
}

/** Sets the loudest point to `peak`, with no clipping. */
function normalize(samples, peak = 0.9) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
  return samples;
}

/** Fades the edges so a one-shot never clicks. */
function fadeEdges(samples, ms = 4) {
  const n = Math.min(seconds(ms / 1000), Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    samples[i] *= i / n;
    samples[samples.length - 1 - i] *= i / n;
  }
  return samples;
}

/** A one-pole low-pass filter: `amount` near 0 is dull, near 1 is bright. */
function lowPass(samples, amount) {
  let y = 0;
  return samples.map((x) => (y += amount * (x - y)));
}

const decay = (t, rate) => Math.exp(-t * rate);

// --- The sounds --------------------------------------------------------------------

/** A dull thud, like a fist on a desk. */
function thud(duration = 0.16, pitch = 95) {
  const n = noiseSource(3);
  let phase = 0;
  return render(duration, (t) => {
    phase += (pitch * (1 - t * 2.5)) / RATE;
    return sine(phase) * decay(t, 22) + n() * 0.25 * decay(t, 90);
  });
}

/** Knuckles hitting glass, with a heavy low end. */
function punch() {
  const n = noiseSource(5);
  let phase = 0;
  const body = render(0.3, (t) => {
    phase += (150 * Math.exp(-t * 9) + 38) / RATE;
    return sine(phase) * decay(t, 13);
  });
  const smack = lowPass(
    render(0.05, (t) => n() * decay(t, 70)),
    0.55,
  );
  return mixIn(body, smack, 0, 0.8);
}

/** Glass giving way: a sharp crack, then splinters running off and tinkling. */
function crack() {
  const n = noiseSource(7);
  const out = new Float32Array(seconds(0.9));
  mixIn(
    out,
    render(0.035, (t) => n() * decay(t, 60)),
  );
  const pick = noiseSource(11);
  for (let i = 0; i < 26; i++) {
    const at = Math.pow((pick() + 1) / 2, 1.8) * 0.7;
    const pitch = 1800 + ((pick() + 1) / 2) * 4200;
    let phase = 0;
    const shard = render(0.05 + ((pick() + 1) / 2) * 0.06, (t) => {
      phase += pitch / RATE;
      return square(phase) * decay(t, 45);
    });
    mixIn(out, shard, at, 0.34 * (1 - at * 0.8));
  }
  return out;
}

/** An old telephone bell: two tones hammered fast, then silence. Loops. */
function ring() {
  let a = 0;
  let b = 0;
  return render(3, (t) => {
    if (t > 1.5) return 0;
    a += 980 / RATE;
    b += 1240 / RATE;
    const hammer = 0.55 + 0.45 * square(t * 22);
    const envelope = Math.min(1, t * 80) * Math.min(1, (1.5 - t) * 40);
    return (square(a) * 0.5 + square(b) * 0.5) * hammer * envelope;
  });
}

function click() {
  const n = noiseSource(13);
  return lowPass(
    render(0.05, (t) => n() * decay(t, 110)),
    0.6,
  );
}

/** Vinnie talking: gruff square-wave syllables in no language at all. Loops. */
function talk() {
  const pick = noiseSource(17);
  const duration = 4;
  const out = new Float32Array(seconds(duration));
  let at = 0;
  while (at < duration - 0.14) {
    const length = 0.05 + ((pick() + 1) / 2) * 0.06;
    const pitch = 125 + ((pick() + 1) / 2) * 95;
    let phase = 0;
    const syllable = render(length, (t) => {
      phase += (pitch * (1 - t * 1.2)) / RATE;
      const envelope = Math.min(1, t * 200) * Math.min(1, (length - t) * 120);
      return square(phase) * envelope;
    });
    mixIn(out, syllable, at);
    // Mostly quick, with the odd pause for breath.
    at += length + (pick() > 0.72 ? 0.07 : 0.015);
  }
  return lowPass(out, 0.5);
}

/** Paper being handled. */
function rustle() {
  const n = noiseSource(19);
  const burst = noiseSource(23);
  const out = new Float32Array(seconds(0.34));
  for (let at = 0; at < 0.28; at += 0.035 + ((burst() + 1) / 2) * 0.04) {
    const part = render(0.04, (t) => n() * decay(t, 70));
    mixIn(out, part, at, 0.4 + ((burst() + 1) / 2) * 0.6);
  }
  // Keep only the crisp part of the noise.
  const dull = lowPass(out, 0.35);
  return out.map((v, i) => v - dull[i]);
}

/** Espresso machine: steam hiss with a low gurgle underneath. */
function hiss() {
  const n = noiseSource(29);
  const steam = render(1, (t) => n() * Math.min(1, t * 12) * Math.min(1, (1 - t) * 5));
  const dull = lowPass(steam, 0.5);
  let phase = 0;
  return steam.map((v, i) => {
    const t = i / RATE;
    phase += 62 / RATE;
    const bubble = square(phase) * (0.5 + 0.5 * sine(t * 9)) * Math.min(1, (1 - t) * 3);
    return (v - dull[i]) * 0.7 + bubble * 0.12;
  });
}

/** Rain on a window, with no seam when it loops. */
function rain() {
  const n = noiseSource(31);
  const drops = noiseSource(37);
  const duration = 5;
  const raw = render(duration, () => n());
  const soft = lowPass(raw, 0.32);
  const dull = lowPass(soft, 0.03);
  const out = soft.map((v, i) => v - dull[i]);
  for (let i = 0; i < 90; i++) {
    const at = ((drops() + 1) / 2) * (duration - 0.03);
    const pitch = 900 + ((drops() + 1) / 2) * 1800;
    let phase = 0;
    const drop = render(0.02, (t) => {
      phase += pitch / RATE;
      return sine(phase) * decay(t, 200);
    });
    mixIn(out, drop, at, 0.5);
  }
  // Crossfade the tail into the head.
  const fade = seconds(0.4);
  const looped = out.slice(0, out.length - fade);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    looped[i] = looped[i] * k + out[out.length - fade + i] * (1 - k);
  }
  return looped;
}

/** Synthesizes a cat: a buzzy tone sliding up and back down, with a nasal edge. */
function catCry(duration, from, top, to, wobble) {
  let phase = 0;
  const raw = render(duration, (t) => {
    const k = t / duration;
    const pitch =
      k < 0.35 ? from + (top - from) * (k / 0.35) : top + (to - top) * ((k - 0.35) / 0.65);
    phase += (pitch + Math.sin(t * 40) * wobble) / RATE;
    const envelope = Math.min(1, t * 25) * Math.min(1, (duration - t) * 9);
    return (saw(phase) * 0.6 + sine(phase * 2) * 0.4) * envelope;
  });
  return lowPass(raw, 0.55);
}

const meow = () => catCry(0.42, 520, 860, 430, 8);
const yowl = () => catCry(0.8, 420, 980, 300, 45);

/** Four paws on a wooden floor, at speed. As long as his lap of the office. */
function scurry() {
  const out = new Float32Array(seconds(3.2));
  const pick = noiseSource(41);
  let at = 0;
  while (at < 3.1) {
    let phase = 0;
    const pitch = 240 + ((pick() + 1) / 2) * 160;
    const paw = render(0.025, (t) => {
      phase += pitch / RATE;
      return sine(phase) * decay(t, 170);
    });
    mixIn(out, paw, at, 0.6 + ((pick() + 1) / 2) * 0.4);
    at += 0.052 + ((pick() + 1) / 2) * 0.02;
  }
  return out;
}

/** A coin, in two notes. */
function coin() {
  let phase = 0;
  return render(0.3, (t) => {
    phase += (t < 0.07 ? 988 : 1319) / RATE;
    const k = t < 0.07 ? 1 : decay(t - 0.07, 11);
    return square(phase) * k;
  });
}

/** Parcel tape coming off the roll. */
function tape() {
  const n = noiseSource(43);
  const raw = render(0.55, (t) => {
    const tick = square(t * (70 + t * 110));
    return n() * (0.55 + 0.45 * tick) * Math.min(1, t * 20) * Math.min(1, (0.55 - t) * 18);
  });
  const dull = lowPass(raw, 0.4);
  return raw.map((v, i) => v - dull[i]);
}

// name: [samples, keeps its exact length so it can loop]
const SOUNDS = {
  thud: [thud()],
  punch: [punch()],
  crack: [crack()],
  ring: [ring(), true],
  click: [click()],
  talk: [talk(), true],
  rustle: [rustle()],
  hiss: [hiss()],
  rain: [rain(), true],
  meow: [meow()],
  yowl: [yowl()],
  scurry: [scurry()],
  coin: [coin()],
  tape: [tape()],
};

// --- WAV files ---------------------------------------------------------------------

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, [samples, loops]] of Object.entries(SOUNDS)) {
  const finished = normalize(loops ? samples : fadeEdges(samples));
  const file = wav(finished);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), file);
  let peak = 0;
  for (const v of finished) peak = Math.max(peak, Math.abs(v));
  const size = `${Math.round(file.length / 1024)} KB`.padStart(7);
  console.log(
    `${name.padEnd(8)} ${(finished.length / RATE).toFixed(2)}s ${size}  peak ${peak.toFixed(2)}`,
  );
}
