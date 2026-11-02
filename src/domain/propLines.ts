// What Vinnie says when you tap something in the office (blueprint 3.5).

import props from '@/content/props.json';

import { fillPlaceholders } from './reaction/dialogue';
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
