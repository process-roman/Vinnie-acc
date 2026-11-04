import { createBuffer, fillRect, hex, setPixel } from '../pixels';

export const ALERT_W = 16;
export const ALERT_H = 19;

/** The "!" bubble that pops over Vinnie's head. */
export function buildAlertBubble() {
  const b = createBuffer(ALERT_W, ALERT_H);
  const ink = hex('#1a1210');
  const paper = hex('#fffaf0');
  const red = hex('#c4302b');
  fillRect(b, 2, 0, 12, 1, ink);
  fillRect(b, 0, 2, 1, 11, ink);
  fillRect(b, 15, 2, 1, 11, ink);
  fillRect(b, 2, 15, 12, 1, ink);
  setPixel(b, 1, 1, ink);
  setPixel(b, 14, 1, ink);
  setPixel(b, 1, 14, ink);
  setPixel(b, 14, 14, ink);
  fillRect(b, 1, 2, 14, 12, paper);
  fillRect(b, 2, 1, 12, 14, paper);
  fillRect(b, 7, 3, 2, 7, red);
  fillRect(b, 7, 11, 2, 2, red);
  // The tail.
  fillRect(b, 6, 15, 4, 1, paper);
  fillRect(b, 6, 16, 3, 1, ink);
  setPixel(b, 7, 16, paper);
  fillRect(b, 7, 17, 2, 1, ink);
  setPixel(b, 7, 18, ink);
  return b;
}
