// Generates the game's sound effects as small WAV files in assets/sounds.
/* global Buffer */
// Every sound is synthesized here from waveforms and seeded noise, so they're ours to use
// and easy to tweak. The aim is a warm 16-bit console: still plainly retro, but built from
// rounded waves, soft edges and a little echo rather than raw square waves.
// Run with: npm run sounds

const fs = require('fs');
const path = require('path');

const RATE = 24000;
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

const sine = (phase) => Math.sin(phase * Math.PI * 2);
const triangle = (phase) => 1 - 4 * Math.abs((phase % 1) - 0.5);
const seconds = (t) => Math.round(t * RATE);
const decay = (t, rate) => Math.exp(-t * rate);
/** 0 to 1, rising then falling, with no corners. */
const hump = (k) => Math.sin(Math.PI * Math.min(1, Math.max(0, k)));

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
function normalize(samples, peak) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
  return samples;
}

/** Fades the edges so a one-shot never clicks. */
function fadeEdges(samples, ms = 6) {
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

/** Keeps what `lowPass` would have thrown away. */
function highPass(samples, amount) {
  const dull = lowPass(samples, amount);
  return samples.map((v, i) => v - dull[i]);
}

/** The small room every sound plays in: a few soft repeats, each duller than the last. */
function echo(samples, delay = 0.11, feedback = 0.28, repeats = 3) {
  const out = new Float32Array(samples.length + seconds(delay * repeats) + 1);
  out.set(samples);
  let tap = samples;
  let gain = 1;
  for (let r = 1; r <= repeats; r++) {
    tap = lowPass(tap, 0.5);
    gain *= feedback;
    mixIn(out, tap, delay * r, gain);
  }
  return out;
}

/** One soft mallet note: fundamental, a quiet overtone, and a quick fade. */
function mallet(pitch, duration = 0.32, fade = 11) {
  let a = 0;
  let b = 0;
  return render(duration, (t) => {
    a += pitch / RATE;
    b += (pitch * 3) / RATE;
    const attack = Math.min(1, t * 400);
    return (sine(a) * 0.85 + sine(b) * 0.15 * decay(t, 30)) * decay(t, fade) * attack;
  });
}

// --- The sounds --------------------------------------------------------------------

/** A dull thump, like a fist on a desk. */
function thud() {
  let phase = 0;
  return render(0.2, (t) => {
    phase += (55 + 55 * decay(t, 22)) / RATE;
    return sine(phase) * decay(t, 18) * Math.min(1, t * 500);
  });
}

/** Knuckles on glass: a round, heavy thump. */
function punch() {
  const n = noiseSource(5);
  let phase = 0;
  const body = render(0.32, (t) => {
    phase += (42 + 90 * decay(t, 16)) / RATE;
    return sine(phase) * decay(t, 11) * Math.min(1, t * 700);
  });
  const smack = lowPass(
    render(0.05, (t) => n() * decay(t, 80)),
    0.18,
  );
  return echo(mixIn(body, smack, 0, 0.7), 0.09, 0.18, 2);
}

/** Glass giving way: a soft crack, then bright chimes running off into the room. */
function crack() {
  const n = noiseSource(7);
  const out = new Float32Array(seconds(0.85));
  mixIn(
    out,
    lowPass(
      render(0.04, (t) => n() * decay(t, 90)),
      0.32,
    ),
    0,
    0.8,
  );
  const pick = noiseSource(11);
  // Notes of one scale, so the shards ring together instead of clashing.
  const scale = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];
  for (let i = 0; i < 16; i++) {
    const at = 0.02 + Math.pow((pick() + 1) / 2, 1.6) * 0.62;
    const note = scale[Math.floor(((pick() + 1) / 2) * scale.length) % scale.length];
    mixIn(out, mallet(note, 0.18, 24), at, 0.32 * (1 - at * 0.75));
  }
  return echo(out, 0.12, 0.3, 3);
}

/** A soft old telephone: two warm ring-rings with a gentle flutter, then quiet. Loops. */
function ring() {
  const out = new Float32Array(seconds(3));
  const burst = (length) => {
    let a = 0;
    let b = 0;
    return render(length, (t) => {
      a += 740 / RATE;
      b += 932 / RATE;
      const flutter = 0.72 + 0.28 * sine(t * 17);
      const edges = Math.min(1, t * 40) * Math.min(1, (length - t) * 25);
      return (sine(a) * 0.6 + sine(b) * 0.4) * flutter * edges;
    });
  };
  mixIn(out, burst(0.42), 0.05);
  mixIn(out, burst(0.42), 0.62);
  return out;
}

/** A small, round tick. */
function click() {
  return mallet(880, 0.06, 70);
}

/** Vinnie talking: rounded little syllables in no language at all. Loops. */
function talk() {
  const pick = noiseSource(17);
  const duration = 4;
  const out = new Float32Array(seconds(duration));
  let at = 0;
  while (at < duration - 0.2) {
    const length = 0.07 + ((pick() + 1) / 2) * 0.06;
    const pitch = 165 + ((pick() + 1) / 2) * 75;
    const slide = (pick() > 0 ? 1 : -1) * 0.5;
    let phase = 0;
    const syllable = render(length, (t) => {
      phase += (pitch * (1 + slide * (t / length) * 0.3)) / RATE;
      // A round body with a hint of mouth in it.
      return (triangle(phase) * 0.7 + sine(phase * 2) * 0.3) * hump(t / length);
    });
    mixIn(out, syllable, at);
    // Mostly quick, with the odd pause for breath.
    at += length + (pick() > 0.75 ? 0.09 : 0.02);
  }
  return lowPass(out, 0.42);
}

/** Paper being handled. */
function rustle() {
  const n = noiseSource(19);
  const burst = noiseSource(23);
  const out = new Float32Array(seconds(0.36));
  for (let at = 0; at < 0.3; at += 0.04 + ((burst() + 1) / 2) * 0.04) {
    const length = 0.04;
    const part = render(length, (t) => n() * hump(t / length));
    mixIn(out, part, at, 0.4 + ((burst() + 1) / 2) * 0.6);
  }
  // The middle of the noise only: not the hiss, not the rumble.
  return lowPass(highPass(out, 0.12), 0.4);
}

/** Espresso machine: breathy steam with a soft gurgle underneath. */
function hiss() {
  const n = noiseSource(29);
  const steam = lowPass(
    highPass(
      render(1.05, (t) => n() * Math.min(1, t * 8) * Math.min(1, (1.05 - t) * 4)),
      0.2,
    ),
    0.45,
  );
  let phase = 0;
  return steam.map((v, i) => {
    const t = i / RATE;
    phase += (70 + sine(t * 4) * 12) / RATE;
    const bubble = sine(phase) * (0.5 + 0.5 * sine(t * 8)) * hump(t / 1.05);
    return v * 0.8 + bubble * 0.22;
  });
}

/** Gentle rain on a window, with no seam when it loops. */
function rain() {
  const n = noiseSource(31);
  const drops = noiseSource(37);
  const duration = 5;
  // Noise this dull reads as a far-off patter rather than static.
  const out = lowPass(
    highPass(
      render(duration, () => n()),
      0.02,
    ),
    0.14,
  );
  for (let i = 0; i < 70; i++) {
    const at = ((drops() + 1) / 2) * (duration - 0.05);
    const note = 700 + ((drops() + 1) / 2) * 900;
    mixIn(out, mallet(note, 0.03, 130), at, 0.06);
  }
  // Crossfade the tail into the head.
  const fade = seconds(0.5);
  const looped = out.slice(0, out.length - fade);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    looped[i] = looped[i] * k + out[out.length - fade + i] * (1 - k);
  }
  return looped;
}

/** A cat: a round tone sliding up and back down, shaped like the vowels in "mee-ow". */
function catCry(duration, from, top, to, wobble) {
  let phase = 0;
  const raw = render(duration, (t) => {
    const k = t / duration;
    // Smooth curves up and down, not straight lines.
    const rise = hump(Math.min(1, k / 0.8) * 0.5);
    const fall = k < 0.4 ? 0 : hump(((k - 0.4) / 0.6) * 0.5);
    const pitch = from + (top - from) * rise + (to - top) * fall;
    phase += (pitch + sine(t * 6) * wobble) / RATE;
    // Opens up in the middle of the sound, like a mouth.
    const open = 0.15 + 0.5 * hump(k);
    const body = sine(phase) + sine(phase * 2) * open + sine(phase * 3) * open * 0.35;
    const edges = Math.min(1, t * 22) * Math.min(1, (duration - t) * 8);
    return body * edges;
  });
  return echo(lowPass(raw, 0.5), 0.09, 0.14, 2);
}

const meow = () => catCry(0.46, 560, 820, 500, 7);
const yowl = () => catCry(0.85, 480, 900, 360, 28);

/** Four paws on a wooden floor, at speed. As long as his lap of the office. */
function scurry() {
  const out = new Float32Array(seconds(3.2));
  const pick = noiseSource(41);
  let at = 0;
  while (at < 3.1) {
    const note = 220 + ((pick() + 1) / 2) * 130;
    mixIn(out, mallet(note, 0.03, 120), at, 0.6 + ((pick() + 1) / 2) * 0.4);
    at += 0.058 + ((pick() + 1) / 2) * 0.022;
  }
  return out;
}

/** A coin, in two bright, round notes. */
function coin() {
  const out = new Float32Array(seconds(0.4));
  mixIn(out, mallet(988, 0.12, 22));
  mixIn(out, mallet(1319, 0.32, 12), 0.08);
  return echo(out, 0.1, 0.22, 2);
}

/** Parcel tape coming off the roll, with the screech taken out. */
function tape() {
  const n = noiseSource(43);
  const length = 0.55;
  const raw = render(length, (t) => {
    const tick = 0.65 + 0.35 * sine(t * (55 + t * 70));
    return n() * tick * hump(t / length);
  });
  return lowPass(highPass(raw, 0.1), 0.35);
}

/** Three rising notes: he approves, and he'd rather you didn't mention it. */
function approve() {
  const out = new Float32Array(seconds(0.62));
  mixIn(out, mallet(523, 0.28, 11));
  mixIn(out, mallet(659, 0.28, 11), 0.1);
  mixIn(out, mallet(784, 0.42, 8), 0.2);
  return echo(out, 0.13, 0.22, 2);
}

/** Two falling notes, low and unimpressed: the raised eyebrow. */
function frown() {
  const note = (pitch, length) => {
    let phase = 0;
    return render(length, (t) => {
      phase += (pitch * (1 - (t / length) * 0.03)) / RATE;
      const edges = Math.min(1, t * 60) * Math.min(1, (length - t) * 7);
      return (triangle(phase) * 0.7 + sine(phase) * 0.3) * edges;
    });
  };
  const out = new Float32Array(seconds(0.56));
  mixIn(out, note(196, 0.2));
  mixIn(out, note(156, 0.36), 0.18);
  return echo(lowPass(out, 0.4), 0.12, 0.16, 2);
}

// name: [samples, peak level, loops]. Looping sounds keep their exact length.
const SOUNDS = {
  thud: [thud(), 0.8],
  punch: [punch(), 0.85],
  crack: [crack(), 0.7],
  ring: [ring(), 0.6, true],
  click: [click(), 0.5],
  talk: [talk(), 0.6, true],
  rustle: [rustle(), 0.55],
  hiss: [hiss(), 0.5],
  rain: [rain(), 0.6, true],
  meow: [meow(), 0.7],
  yowl: [yowl(), 0.75],
  scurry: [scurry(), 0.5],
  coin: [coin(), 0.6],
  tape: [tape(), 0.5],
  approve: [approve(), 0.65],
  frown: [frown(), 0.7],
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
for (const [name, [samples, level, loops]] of Object.entries(SOUNDS)) {
  const finished = normalize(loops ? samples : fadeEdges(samples), level);
  const file = wav(finished);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), file);
  const size = `${Math.round(file.length / 1024)} KB`.padStart(7);
  console.log(`${name.padEnd(8)} ${(finished.length / RATE).toFixed(2)}s ${size}`);
}
