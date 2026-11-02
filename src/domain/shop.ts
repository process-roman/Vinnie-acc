// "Appease Vinnie" (blueprint Screen 5, 6.3): gifts lift his mood, office items are
// permanent cosmetics in slots. Gifts never repair cracks. No real money anywhere.

import data from '@/content/shop.json';

export type Gift = { id: string; name: string; price: number; mood: number; line: string };
export type ItemSlot = 'floor' | 'cat' | 'sign' | 'espresso' | 'walls' | 'outfit';
export type Item = { id: string; name: string; price: number; slot: ItemSlot; line: string };

export const GIFTS = data.gifts as Gift[];
export const ITEMS = data.items as Item[];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

export type Owned = { itemId: string; equipped: boolean };

export type PurchaseResult =
  | { ok: true; cost: number }
  | { ok: false; reason: 'not_enough_coins' | 'already_owned' | 'unknown' };

export function canBuy(id: string, coins: number, owned: readonly Owned[]): PurchaseResult {
  const gift = GIFTS.find((g) => g.id === id);
  const item = itemById(id);
  const thing = gift ?? item;
  if (!thing) return { ok: false, reason: 'unknown' };
  if (item && owned.some((o) => o.itemId === id)) return { ok: false, reason: 'already_owned' };
  if (coins < thing.price) return { ok: false, reason: 'not_enough_coins' };
  return { ok: true, cost: thing.price };
}

/** Equipping an item takes the slot from whatever was there. Unequipping clears it. */
export function equip(owned: readonly Owned[], id: string, on: boolean): Owned[] {
  const slot = itemById(id)?.slot;
  return owned.map((o) => {
    if (o.itemId === id) return { ...o, equipped: on };
    if (on && itemById(o.itemId)?.slot === slot) return { ...o, equipped: false };
    return o;
  });
}

/** The equipped item per slot, for the scene. */
export function equippedBySlot(owned: readonly Owned[]): Partial<Record<ItemSlot, string>> {
  const out: Partial<Record<ItemSlot, string>> = {};
  for (const o of owned) {
    const item = itemById(o.itemId);
    if (o.equipped && item) out[item.slot] = item.id;
  }
  return out;
}
