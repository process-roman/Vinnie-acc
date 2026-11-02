// Vinnie's head and shoulders, scaled up for the call screen.

import { Canvas, Group, Image, rect } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PixelRatio } from 'react-native';

import { PIXEL_SAMPLING, toSkImage } from './skiaImage';
import { buildVinnieSheet, VINNIE_W } from './sprites/vinnie';

/** Rows from the top of the sprite: hair down to the collar. */
const CROP_H = 11;

export function VinnieAvatar({ size }: { size: number }) {
  const image = useMemo(() => toSkImage(buildVinnieSheet()), []);
  // Whole device pixels per art pixel, like the office.
  const ratio = PixelRatio.get();
  const scale = Math.max(1, Math.floor((size * ratio) / VINNIE_W)) / ratio;
  const w = VINNIE_W * scale;
  const h = CROP_H * scale;
  return (
    <Canvas style={{ width: w, height: h }} accessibilityLabel="Vinnie">
      <Group transform={[{ scale }]} clip={rect(0, 0, VINNIE_W, CROP_H)}>
        <Image
          image={image}
          x={0}
          y={0}
          width={image.width()}
          height={image.height()}
          sampling={PIXEL_SAMPLING}
        />
      </Group>
    </Canvas>
  );
}
