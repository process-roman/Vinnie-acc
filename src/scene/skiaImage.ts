import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  SamplingOptions,
  Skia,
  SkImage,
} from '@shopify/react-native-skia';

import { PixelBuffer } from './pixels';

/** Nearest-neighbour sampling: every art pixel scales up to a crisp square. */
export const PIXEL_SAMPLING: SamplingOptions = {
  filter: FilterMode.Nearest,
  mipmap: MipmapMode.None,
};

export function toSkImage(buf: PixelBuffer): SkImage {
  const image = Skia.Image.MakeImage(
    {
      width: buf.width,
      height: buf.height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    },
    Skia.Data.fromBytes(buf.data),
    buf.width * 4,
  );
  if (!image) throw new Error(`Could not create a ${buf.width}x${buf.height} image`);
  return image;
}

/** A PNG data URI for pixel art, e.g. to put a still of the office in a share card. */
export function toPngDataUri(buf: PixelBuffer): string {
  return `data:image/png;base64,${toSkImage(buf).encodeToBase64()}`;
}
