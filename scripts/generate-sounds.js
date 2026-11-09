// Generates the game's sound effects as small WAV files in assets/sounds.
// Every sound is synthesized here from waveforms and seeded noise, so they're ours to use
// and easy to tweak. The aim is modern pixel-game audio, the soft and calm kind: clear bells
// and plucks, notes from one happy scale, a gentle chiptune pulse for the coins, and a real
// sense of room. Nothing harsh, nothing muffled.
// Run with: npm run sounds

const fs = require('fs');
const path = require('path');

const RATE = 32000;
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

const TAU = Math.PI * 2;
const seconds = (t) => Math.round(t * RATE);
const decay = (t, rate) => Math.exp(-t * rate);
/** 0 to 1, rising then falling, with no corners. */
const hump = (k) => Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
/** A note's frequency from its MIDI number: 60 is middle C. */
const note = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Renders `fn(t, i)` for a number of seconds. */
function render(duration, fn) {
  const out = new Float32Array(seconds(duration));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE, i);
  return out;
}

/** Adds `b` into `a` starting at time `at`, growing `a` if it has to. */
function mixIn(a, b, at = 0, gain = 1) {
  const start = seconds(at);
  const out = a.length >= start + b.length ? a : grow(a, start + b.length);
  for (let i = 0; i < b.length; i++) out[start + i] += b[i] * gain;
  return out;
}

function grow(a, length) {
  const out = new Float32Array(length);
  out.set(a);
  return out;
}

/** Sets the loudest point to `peak`, with no clipping. */
function normalize(samples, peak) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
  return samples;
}

/** Removes any offset from zero (pulse waves and plucks drift), which would waste headroom. */
function dcBlock(samples) {
  let x1 = 0;
  let y1 = 0;
  return samples.map((x) => {
    y1 = x - x1 + 0.995 * y1;
    x1 = x;
    return y1;
  });
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

function highPass(samples, amount) {
  const dull = lowPass(samples, amount);
  return samples.map((v, i) => v - dull[i]);
}

/**
 * A small, soft room (a Freeverb-style network of comb and all-pass filters). This is what
 * makes a modern game sound polished rather than bare: every sound gets a gentle tail.
 */
function room(samples, { size = 0.78, damp = 0.35, wet = 0.28, tail = 0.9 } = {}) {
  const input = grow(samples, samples.length + seconds(tail));
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.round((d * RATE) / 44100));
  const allPasses = [556, 441].map((d) => Math.round((d * RATE) / 44100));
  const wetOut = new Float32Array(input.length);
  for (const delay of combs) {
    const buf = new Float32Array(delay);
    let i = 0;
    let filtered = 0;
    for (let n = 0; n < input.length; n++) {
      const out = buf[i];
      filtered = out * (1 - damp) + filtered * damp;
      buf[i] = input[n] * 0.25 + filtered * size;
      wetOut[n] += out;
      i = (i + 1) % delay;
    }
  }
  for (const delay of allPasses) {
    const buf = new Float32Array(delay);
    let i = 0;
    for (let n = 0; n < wetOut.length; n++) {
      const delayed = buf[i];
      const v = wetOut[n];
      buf[i] = v + delayed * 0.5;
      wetOut[n] = delayed - v;
      i = (i + 1) % delay;
    }
  }
  return input.map((dry, n) => dry * (1 - wet * 0.5) + wetOut[n] * wet);
}

// --- Instruments -----------------------------------------------------------------

/** A glassy bell (two-operator FM): bright as it's struck, mellowing as it rings. */
function bell(freq, duration = 0.9, { ratio = 3.5, index = 2.2, fade = 4 } = {}) {
  return render(duration, (t) => {
    const env = decay(t, fade) * Math.min(1, t * 900);
    const mod = Math.sin(TAU * freq * ratio * t) * index * decay(t, fade * 2.5);
    return Math.sin(TAU * freq * t + mod) * env;
  });
}

/** A soft wooden mallet: round, short, a little knock at the start. */
function marimba(freq, duration = 0.4) {
  return render(duration, (t) => {
    const env = decay(t, 9) * Math.min(1, t * 700);
    const mod = Math.sin(TAU * freq * 4 * t) * 1.4 * decay(t, 40);
    return Math.sin(TAU * freq * t + mod) * env;
  });
}

/** A plucked string (Karplus-Strong): warm, natural, never sharp. */
function pluck(freq, duration = 0.6, brightness = 0.5, seed = 1) {
  const n = noiseSource(seed);
  const period = Math.max(2, Math.round(RATE / freq));
  const buf = lowPass(
    Float32Array.from({ length: period }, () => n()),
    brightness,
  );
  const out = new Float32Array(seconds(duration));
  let i = 0;
  for (let k = 0; k < out.length; k++) {
    const next = (i + 1) % period;
    const v = (buf[i] + buf[next]) * 0.5 * 0.996;
    out[k] = buf[i];
    buf[i] = v;
    i = next;
  }
  return out;
}

/**
 * The pixel part: a chiptune pulse wave, but rounded off and with a touch of vibrato, so it
 * reads as a game without the buzz.
 */
function pulse(freq, duration, { duty = 0.25, fade = 6, vibrato = 0 } = {}) {
  let phase = 0;
  const raw = render(duration, (t) => {
    phase += (freq * (1 + Math.sin(TAU * 5.5 * t) * vibrato)) / RATE;
    const wave = phase % 1 < duty ? 1 : -1;
    return wave * decay(t, fade) * Math.min(1, t * 500);
  });
  // Two gentle passes take the edge off the corners but keep the character.
  return lowPass(lowPass(raw, 0.32), 0.5);
}

// --- The sounds ------------------------------------------------------------------

/** A soft wooden tap. */
function click() {
  return room(marimba(note(84), 0.12), { wet: 0.12, tail: 0.25 });
}

/** A fist on the desk: a deep, rounded thump. */
function thud() {
  return room(
    render(
      0.25,
      (t) => Math.sin(TAU * (60 + 70 * decay(t, 25)) * t) * decay(t, 14) * Math.min(1, t * 600),
    ),
    { wet: 0.12, tail: 0.3 },
  );
}

/** Knuckles on glass: a heavy, round thump with a soft knock on top. */
function punch() {
  const n = noiseSource(5);
  const body = render(0.36, (t) => Math.sin(TAU * (48 + 100 * decay(t, 18)) * t) * decay(t, 10));
  const knock = lowPass(
    render(0.03, (t) => n() * decay(t, 120)),
    0.12,
  );
  return room(mixIn(body, knock, 0, 0.6), { wet: 0.15, tail: 0.4 });
}

/** The glass going: a soft crack, then a shower of bell-like shards in a happy scale. */
function crack() {
  const n = noiseSource(7);
  let out = lowPass(
    render(0.05, (t) => n() * decay(t, 70)),
    0.25,
  );
  const pick = noiseSource(11);
  // Major pentatonic, high: there's no wrong note in it, so the shards always sound sweet.
  const scale = [84, 86, 88, 91, 93, 96, 98, 100].map(note);
  for (let i = 0; i < 12; i++) {
    const at = 0.03 + Math.pow((pick() + 1) / 2, 1.5) * 0.55;
    const freq = scale[Math.floor(((pick() + 1) / 2) * scale.length) % scale.length];
    out = mixIn(out, bell(freq, 0.5, { ratio: 3.5, index: 1.5, fade: 9 }), at, 0.28 * (1 - at));
  }
  return room(out, { wet: 0.35, tail: 1 });
}

/** A gentle phone: a short four-note marimba tune, twice, then quiet. Loops. */
function ring() {
  const tune = [note(76), note(79), note(84), note(79)];
  let out = new Float32Array(seconds(3));
  for (const start of [0.05, 0.75]) {
    tune.forEach((f, i) => {
      out = mixIn(out, marimba(f, 0.35), start + i * 0.13, 0.8);
    });
  }
  // Light room, cut back to exactly three seconds so it loops cleanly.
  return room(out, { wet: 0.2, tail: 0 }).slice(0, seconds(3));
}

/**
 * Vinnie talking: little rounded syllables, the cosy kind of gibberish from modern pixel
 * games. A little lower than cute, because he's Vinnie. Loops.
 */
function talk() {
  const pick = noiseSource(17);
  const duration = 4;
  let out = new Float32Array(seconds(duration));
  // Syllables move around a few notes of one scale, so the babble sounds tuneful.
  const notes = [52, 55, 57, 59, 62].map(note);
  let at = 0;
  while (at < duration - 0.2) {
    const length = 0.06 + ((pick() + 1) / 2) * 0.05;
    const freq = notes[Math.floor(((pick() + 1) / 2) * notes.length) % notes.length];
    const vowel = 2 + ((pick() + 1) / 2) * 1.5;
    const syllable = render(length, (t) => {
      const k = t / length;
      const f = freq * (1 + 0.04 * Math.sin(Math.PI * k));
      // A sine with a soft overtone that opens and closes like a mouth.
      return (Math.sin(TAU * f * t) + Math.sin(TAU * f * vowel * t) * 0.18 * hump(k)) * hump(k);
    });
    out = mixIn(out, syllable, at);
    at += length + (pick() > 0.78 ? 0.08 : 0.025);
  }
  return out.slice(0, seconds(duration));
}

/** Paper, handled softly. */
function rustle() {
  const n = noiseSource(19);
  const burst = noiseSource(23);
  const out = new Float32Array(seconds(0.34));
  for (let at = 0; at < 0.28; at += 0.045 + ((burst() + 1) / 2) * 0.04) {
    const length = 0.05;
    const part = render(length, (t) => n() * hump(t / length));
    mixIn(out, part, at, 0.4 + ((burst() + 1) / 2) * 0.5);
  }
  return room(lowPass(highPass(out, 0.15), 0.3), { wet: 0.12, tail: 0.25 });
}

/** The espresso machine: a breath of steam and a soft gurgle. */
function hiss() {
  const n = noiseSource(29);
  const length = 1;
  const steam = lowPass(
    highPass(
      render(length, (t) => n() * hump(t / length)),
      0.25,
    ),
    0.3,
  );
  const gurgle = render(
    length,
    (t) =>
      Math.sin(TAU * (75 + Math.sin(TAU * 4 * t) * 10) * t) *
      hump(t / length) *
      (0.5 + 0.5 * Math.sin(TAU * 7 * t)),
  );
  return room(
    steam.map((v, i) => v * 0.7 + gurgle[i] * 0.25),
    { wet: 0.15, tail: 0.3 },
  );
}

/** Gentle rain, far off, with the odd drop chiming on the glass. Loops. */
function rain() {
  const n = noiseSource(31);
  const drops = noiseSource(37);
  const duration = 5;
  let out = lowPass(
    highPass(
      render(duration, () => n()),
      0.03,
    ),
    0.12,
  );
  const scale = [79, 81, 84, 86, 88].map(note);
  for (let i = 0; i < 28; i++) {
    const at = ((drops() + 1) / 2) * (duration - 0.2);
    const freq = scale[Math.floor(((drops() + 1) / 2) * scale.length) % scale.length];
    out = mixIn(out, bell(freq, 0.18, { index: 0.6, fade: 22 }), at, 0.05);
  }
  out = out.slice(0, seconds(duration));
  // Crossfade the tail into the head.
  const fade = seconds(0.5);
  const looped = out.slice(0, out.length - fade);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    looped[i] = looped[i] * k + out[out.length - fade + i] * (1 - k);
  }
  return looped;
}

/** A cat, the friendly kind: a smooth "mew-ow" that opens up in the middle. */
function catCry(duration, from, top, to, vibrato) {
  const raw = render(duration, (t) => {
    const k = t / duration;
    const glide = k < 0.4 ? hump((k / 0.4) * 0.5) : 1 - hump(((k - 0.4) / 0.6) * 0.5);
    const end = k < 0.4 ? from : to;
    const freq = end + (top - end) * glide + Math.sin(TAU * 6 * t) * vibrato;
    const open = 0.1 + 0.35 * hump(k);
    return (Math.sin(TAU * freq * t) + Math.sin(TAU * freq * 2 * t) * open) * hump(k);
  });
  return room(lowPass(raw, 0.6), { wet: 0.18, tail: 0.35 });
}

const meow = () => catCry(0.42, 600, 840, 560, 5);
const yowl = () => catCry(0.75, 500, 880, 420, 18);

/** Little paws on wood, at speed. As long as his lap of the office. */
function scurry() {
  let out = new Float32Array(seconds(3.2));
  const pick = noiseSource(41);
  let at = 0;
  while (at < 3.1) {
    const freq = note(72 + Math.floor(((pick() + 1) / 2) * 5));
    out = mixIn(out, marimba(freq, 0.05), at, 0.35 + ((pick() + 1) / 2) * 0.25);
    at += 0.06 + ((pick() + 1) / 2) * 0.025;
  }
  return out.slice(0, seconds(3.2));
}

/** A coin: two quick chiptune notes, rounded off, with a little sparkle on top. */
function coin() {
  let out = pulse(note(83), 0.08, { fade: 8 });
  out = mixIn(out, pulse(note(88), 0.35, { fade: 7, vibrato: 0.004 }), 0.07);
  out = mixIn(out, bell(note(100), 0.4, { index: 0.8, fade: 8 }), 0.07, 0.25);
  return room(out, { wet: 0.25, tail: 0.6 });
}

/** Tape coming off the roll, softly. */
function tape() {
  const n = noiseSource(43);
  const length = 0.5;
  const raw = render(
    length,
    (t) => n() * (0.7 + 0.3 * Math.sin(TAU * (50 + t * 60) * t)) * hump(t / length),
  );
  return room(lowPass(highPass(raw, 0.15), 0.28), { wet: 0.12, tail: 0.25 });
}

/** He approves: a rising arpeggio of warm plucks, with a bell on the last note. */
function approve() {
  let out = new Float32Array(0);
  [60, 64, 67, 72].forEach((m, i) => {
    out = mixIn(out, pluck(note(m), 0.7, 0.45, 50 + i), i * 0.08, 0.8);
  });
  out = mixIn(out, bell(note(84), 0.8, { index: 1.2, fade: 4 }), 0.24, 0.3);
  return room(out, { wet: 0.3, tail: 0.8 });
}

/** He has doubts: two soft notes stepping down, unhurried. */
function frown() {
  const soft = (freq, length) =>
    render(length, (t) => {
      const f = freq * (1 - 0.01 * (t / length));
      return (
        (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2 * t) * 0.15) *
        decay(t, 4) *
        Math.min(1, t * 120)
      );
    });
  let out = soft(note(62), 0.28);
  out = mixIn(out, soft(note(58), 0.5), 0.2);
  return room(out, { wet: 0.25, tail: 0.6 });
}

// name: [samples, peak level, loops]. Looping sounds keep their exact length.
// Levels sit low and close together: a calm mix, with nothing jumping out.
const SOUNDS = {
  thud: [thud(), 0.7],
  punch: [punch(), 0.8],
  crack: [crack(), 0.6],
  ring: [ring(), 0.55, true],
  click: [click(), 0.4],
  talk: [talk(), 0.5, true],
  rustle: [rustle(), 0.45],
  hiss: [hiss(), 0.4],
  rain: [rain(), 0.55, true],
  meow: [meow(), 0.6],
  yowl: [yowl(), 0.65],
  scurry: [scurry(), 0.45],
  coin: [coin(), 0.5],
  tape: [tape(), 0.4],
  approve: [approve(), 0.55],
  frown: [frown(), 0.55],
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
  const centred = dcBlock(samples);
  const finished = normalize(loops ? centred : fadeEdges(centred), level);
  const file = wav(finished);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), file);
  const size = `${Math.round(file.length / 1024)} KB`.padStart(7);
  console.log(`${name.padEnd(8)} ${(finished.length / RATE).toFixed(2)}s ${size}`);
}
