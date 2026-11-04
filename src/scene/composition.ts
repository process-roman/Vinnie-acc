// What's in the office and where: shared by the live canvas and the still
// snapshot used for share cards.

import type { CrackLevel } from '@/domain/repair';
import type { RoomState } from '@/domain/roomState';
import type { ItemSlot } from '@/domain/shop';

import { generateCrack } from './crack';
import { depth, GridPoint, gridToScreen } from './iso';
import { SceneSprite, slotDepth, slotPosition, SLOTS } from './layout';
import { rasterizeFurniture, rasterizeOffice } from './furniture';
import { blit, createBuffer, cropToContent, drawLine, hex, PixelBuffer } from './pixels';
import {
  PROPS,
  rasterizeNeonSign,
  rasterizePoster,
  rasterizeRug,
  rasterizeSunPatch,
  rasterizeWindow,
  ROOM_H,
  ROOM_ORIGIN,
  ROOM_W,
} from './room';
import {
  buildPlant,
  buildReceiptPile,
  CAT_BED,
  CAT_SITTING,
  CAT_SLEEPING,
  DELUXE_ESPRESSO,
  ESPRESSO,
  LAMP,
  PHONE,
  STEAM_FRAMES,
} from './sprites/props';
import { buildVinnieSheet, VINNIE_ANCHOR, VINNIE_H, VINNIE_W } from './sprites/vinnie';

export type Cosmetics = Partial<Record<ItemSlot, string>>;

// Pixel buffers are built once per distinct key and reused.
const buffers = new Map<string, PixelBuffer>();
export const buf = (key: string, make: () => PixelBuffer) => {
  let b = buffers.get(key);
  if (!b) {
    b = make();
    buffers.set(key, b);
  }
  return b;
};

export const wallStyle = (c: Cosmetics) =>
  c.walls === 'green_wallpaper' ? ('green_wallpaper' as const) : ('brick' as const);

export const roomBuffer = (c: Cosmetics) =>
  buf(`room:${wallStyle(c)}`, () => rasterizeOffice(wallStyle(c)));

export const vinnieSheet = (c: Cosmetics) =>
  buf(`vinnie:${c.outfit ?? ''}`, () => buildVinnieSheet(c.outfit));

const pieces = new Map<string, ReturnType<typeof cropToContent>>();
const furniturePiece = (id: (typeof PROPS)[number]['id']) => {
  let piece = pieces.get(id);
  if (!piece) {
    piece = cropToContent(rasterizeFurniture(id));
    pieces.set(id, piece);
  }
  return piece;
};

export function buildSprites(room: RoomState, cosmetics: Cosmetics): SceneSprite[] {
  // The credenza's baked into the room: the safe stands in front of it.
  const sprites: SceneSprite[] = PROPS.filter((p) => p.id !== 'cabinet').map((p) => {
    // Cropped, so the GPU isn't drawing a room-sized image for each chair.
    const piece = furniturePiece(p.id);
    return {
      key: p.id,
      frames: [piece.buffer],
      x: piece.x,
      y: piece.y,
      depth: depth({
        gx: p.footprint.gx + p.footprint.w / 2,
        gy: p.footprint.gy + p.footprint.d / 2,
      }),
    };
  });
  const place = (
    key: string,
    slot: (typeof SLOTS)[keyof typeof SLOTS],
    frames: PixelBuffer[],
    order: number,
    extra: Partial<SceneSprite> = {},
  ) =>
    sprites.push({ key, frames, ...slotPosition(slot), depth: slotDepth(slot, order), ...extra });

  place('plant', SLOTS.plant, [buf(`plant:${room.plant}`, () => buildPlant(room.plant))], 0, {
    tap: 'plant',
  });
  place(
    'pile',
    SLOTS.pile,
    [buf(`pile:${room.receipts}`, () => buildReceiptPile(room.receipts))],
    0,
    { tap: 'receipts' },
  );
  place('lamp', SLOTS.lamp, [LAMP], 0);
  place('phone', SLOTS.phone, [PHONE], 1, { tap: 'phone' });
  const machine = cosmetics.espresso === 'deluxe_espresso' ? DELUXE_ESPRESSO : ESPRESSO;
  place('espresso', SLOTS.espresso, [machine], 0, { tap: 'espresso' });
  if (cosmetics.cat === 'cat_bed') place('catBed', SLOTS.catBed, [CAT_BED], 0, { tap: 'cat' });
  if (room.espressoSteaming) place('steam', SLOTS.steam, STEAM_FRAMES, 1, { frameMs: 220 });
  if (room.cat === 'sleeping') {
    place('cat', SLOTS.catSleeping, CAT_SLEEPING, 2, { frameMs: 900, tap: 'cat' });
  } else if (room.cat === 'sitting') {
    // With a bed, she sits in it.
    const slot = cosmetics.cat === 'cat_bed' ? SLOTS.catInBed : SLOTS.catOnFloor;
    place('cat', slot, CAT_SITTING, 1, { frameMs: 700, tap: 'cat' });
  }
  return sprites.sort((a, b) => a.depth - b.depth);
}

export type SnapshotInput = {
  room: RoomState;
  cosmetics: Cosmetics;
  /** Which frame of Vinnie's sheet to show, and where he stands. */
  vinnieFrame: number;
  at: GridPoint;
  crackLevel: CrackLevel;
  crackSeed: number;
};

const CRACK_LINE = hex('#ffffff');
const CRACK_SHADOW = hex('#1b1410');

/** The whole office as one still pixel buffer (for share cards). */
export function composeSnapshot(s: SnapshotInput): PixelBuffer {
  const out = createBuffer(ROOM_W, ROOM_H);
  blit(out, roomBuffer(s.cosmetics), 0, 0);
  blit(
    out,
    buf(`sun:${s.room.weather}`, () => rasterizeSunPatch(s.room.weather)),
    0,
    0,
  );
  if (s.cosmetics.floor === 'rug') blit(out, buf('rug', rasterizeRug), 0, 0);
  if (s.cosmetics.sign === 'neon_sign') {
    blit(
      out,
      buf('neon:on', () => rasterizeNeonSign(true)),
      0,
      0,
    );
  }
  blit(
    out,
    buf(`window:${s.room.weather}:0`, () => rasterizeWindow(s.room.weather, 0)),
    0,
    0,
  );
  blit(
    out,
    buf(`poster:${s.room.poster}`, () => rasterizePoster(s.room.poster)),
    0,
    0,
  );

  // Vinnie, cut from his sheet, sorted in among the furniture.
  const sheet = vinnieSheet(s.cosmetics);
  const vinnie = createBuffer(VINNIE_W, VINNIE_H);
  for (let y = 0; y < VINNIE_H; y++) {
    const from = (y * sheet.width + s.vinnieFrame * VINNIE_W) * 4;
    vinnie.data.set(sheet.data.subarray(from, from + VINNIE_W * 4), y * VINNIE_W * 4);
  }
  const feet = gridToScreen(s.at, ROOM_ORIGIN);
  const vDepth = depth(s.at);
  let drawn = false;
  const drawVinnie = () => {
    blit(out, vinnie, Math.round(feet.x) - VINNIE_ANCHOR.x, Math.round(feet.y) - VINNIE_ANCHOR.y);
    drawn = true;
  };
  for (const sp of buildSprites(s.room, s.cosmetics)) {
    if (!drawn && sp.depth > vDepth) drawVinnie();
    blit(out, sp.frames[0], sp.x, sp.y);
  }
  if (!drawn) drawVinnie();

  // The crack, drawn across the whole picture.
  for (const seg of generateCrack(s.crackLevel, ROOM_W, ROOM_H, s.crackSeed, {
    x: Math.round(feet.x),
    y: Math.round(feet.y) - VINNIE_H + 4,
  })) {
    drawLine(out, seg.x0 + 1, seg.y0 + 1, seg.x1 + 1, seg.y1 + 1, CRACK_SHADOW);
    drawLine(out, seg.x0, seg.y0, seg.x1, seg.y1, CRACK_LINE);
  }
  return out;
}

/** Nearest-neighbour upscale, so the snapshot stays crisp as a PNG. */
export function scaleNearest(src: PixelBuffer, k: number): PixelBuffer {
  const out = createBuffer(src.width * k, src.height * k);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / k);
    for (let x = 0; x < out.width; x++) {
      const si = (sy * src.width + Math.floor(x / k)) * 4;
      out.data.set(src.data.subarray(si, si + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}
