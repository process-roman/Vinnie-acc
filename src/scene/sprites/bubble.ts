import { hex, spriteFromRows } from '../pixels';

const ROWS = [
  '.kkkkkkk.',
  'kwwwwwwwk',
  'kwwwrwwwk',
  'kwwwrwwwk',
  'kwwwrwwwk',
  'kwwwwwwwk',
  'kwwwrwwwk',
  'kwwwwwwwk',
  '.kkkwkkk.',
  '....kk...',
];

/** The "!" bubble that pops over Vinnie's head. */
export function buildAlertBubble() {
  return spriteFromRows(ROWS, { k: hex('#1a1210'), w: hex('#fffaf0'), r: hex('#c4302b') });
}
