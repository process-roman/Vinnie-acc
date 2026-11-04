// What Vinnie says when you tap something in the office (blueprint 3.5).

import props from '@/content/props.json';

import { fillPlaceholders, Heat } from './reaction/dialogue';
import { RoomState } from './roomState';

export type PropTarget =
  'plant' | 'window' | 'cat' | 'phone' | 'espresso' | 'poster' | 'receipts' | 'vinnie';

/** The line pool for a prop in the current room state. */
export function propLinePool(target: PropTarget, room: RoomState): string[] {
  switch (target) {
    case 'plant':
      return props.plant[room.plant];
    case 'window':
      return props.window[room.weather];
    case 'espresso':
      return props.espresso[room.espressoSteaming ? 'steaming' : 'cold'];
    case 'poster':
      return props.poster[room.poster];
    case 'cat':
      return props.cat;
    case 'phone':
      return props.phone;
    case 'receipts':
      return props.receipts;
    case 'vinnie':
      return props.vinnie;
  }
}

/** Picks a line, never the same as the last one for this prop. */
export function pickPropLine(
  target: PropTarget,
  room: RoomState,
  last: string | undefined,
  rand: () => number,
): string {
  const fill = (l: string) => fillPlaceholders(l, { count: room.receipts });
  // A count line only makes sense once there's a pile to count.
  const pool = propLinePool(target, room)
    .filter((l) => room.receipts >= 2 || !l.includes('{count}'))
    .map(fill);
  const fresh = pool.length > 1 ? pool.filter((l) => l !== last) : pool;
  return fresh[Math.floor(rand() * fresh.length)];
}

/** Taps on Vinnie in a row, each within TAP_GAP_MS of the last, before he snaps. */
export const FED_UP_TAPS = 3;
export const TAP_GAP_MS = 1500;

export type TapStreak = { count: number; at: number };
export const NO_TAPS: TapStreak = { count: 0, at: 0 };

export function nextTapStreak(streak: TapStreak, now: number): TapStreak {
  return { count: now - streak.at <= TAP_GAP_MS ? streak.count + 1 : 1, at: now };
}

/** What he says when you won't stop poking him. Only lines written for this heat. */
export function pickFedUpLine(heat: Heat, last: string | undefined, rand: () => number): string {
  const pool = props.vinnieFedUp.filter((l) => l.minHeat === heat).map((l) => l.text);
  const fresh = pool.filter((l) => l !== last);
  return fresh[Math.floor(rand() * fresh.length)];
}
