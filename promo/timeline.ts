// When everything happens in the promo, in seconds. The music, the sound effects and the
// pictures all read from here, so they stay in step.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BPM = 116;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

/** Scene starts. Most land on a bar line, so cuts hit the music. */
export const T = {
  open: 0,
  vinnieCard: BAR,
  rule: BAR * 2,
  lucCard: BAR * 4,
  warning: BAR * 5,
  /** The music stops dead as the receipt lands. */
  receipt: BAR * 6,
  walk: BAR * 6 + 1.2,
  punch: BAR * 6 + 2.6,
  ring: BAR * 6 + 4,
  answer: BAR * 6 + 5.6,
  /** The music comes back in for the end card. */
  end: BAR * 6 + 8.4,
  done: BAR * 6 + 8.4 + BAR * 2.5,
};

export const DURATION = T.done;
