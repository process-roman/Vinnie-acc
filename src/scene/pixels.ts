// Low-resolution RGBA pixel buffers. All placeholder art is built here and
// scaled up with nearest-neighbour sampling, so it stays crisp at any size.

export type PixelBuffer = {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, row-major, unpremultiplied
};

export type Rgba = readonly [number, number, number, number];

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function hex(color: string, alpha = 255): Rgba {
  const n = parseInt(color.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

export function setPixel(buf: PixelBuffer, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return;
  const i = (y * buf.width + x) * 4;
  buf.data[i] = c[0];
  buf.data[i + 1] = c[1];
  buf.data[i + 2] = c[2];
  buf.data[i + 3] = c[3];
}

export function getPixel(buf: PixelBuffer, x: number, y: number): Rgba {
  const i = (y * buf.width + x) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
}

/**
 * Builds a sprite from rows of palette characters. '.' is transparent.
 * Every row must have the same length and every character must be in the palette.
 */
export function spriteFromRows(
  rows: readonly string[],
  palette: Record<string, Rgba>,
): PixelBuffer {
  const width = rows[0]?.length ?? 0;
  const buf = createBuffer(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Sprite row ${y} has length ${row.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = palette[ch];
      if (!c) throw new Error(`Sprite uses unknown palette key '${ch}'`);
      setPixel(buf, x, y, c);
    }
  });
  return buf;
}

/** Copies src onto dst at (dx, dy), skipping fully transparent pixels. */
export function blit(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const c = getPixel(src, x, y);
      if (c[3] === 0) continue;
      setPixel(dst, dx + x, dy + y, c);
    }
  }
}

/** Places frames side by side in one sheet. All frames must share a size. */
export function packSheet(frames: readonly PixelBuffer[]): PixelBuffer {
  const { width, height } = frames[0];
  const sheet = createBuffer(width * frames.length, height);
  frames.forEach((f, i) => blit(sheet, f, i * width, 0));
  return sheet;
}

/** Integer-pixel line (Bresenham). */
export function drawLine(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: Rgba,
): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(buf, x0, y0, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
