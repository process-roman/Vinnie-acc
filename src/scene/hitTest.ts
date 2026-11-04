// Which character a tap is for. They're small and they move, so a tap only has to land
// near one; the closest wins.

export type CharacterBox<T> = { id: T; x: number; y: number; w: number; h: number };

/** Roughly a fingertip's reach, in art pixels. */
export const TAP_SLOP = 10;

export function characterAt<T>(
  ax: number,
  ay: number,
  boxes: readonly CharacterBox<T>[],
  slop = 0,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const b of boxes) {
    const inside =
      ax >= b.x - slop && ax < b.x + b.w + slop && ay >= b.y - slop && ay < b.y + b.h + slop;
    if (!inside) continue;
    const distance = Math.hypot(ax - (b.x + b.w / 2), ay - (b.y + b.h / 2));
    if (distance < bestDistance) {
      best = b.id;
      bestDistance = distance;
    }
  }
  return best;
}
