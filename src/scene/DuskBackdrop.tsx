// Brooklyn at dusk, filling the screen behind the opening scene. Scaled by whole device
// pixels like the office, big enough to cover, and anchored to the bottom so the river and
// the bridge always show.

import { Canvas, Image } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions } from 'react-native';

import { PIXEL_SAMPLING, toSkImage } from './skiaImage';
import { buildDusk, DUSK_H, DUSK_W } from './sprites/dusk';

export function DuskBackdrop() {
  const image = useMemo(() => toSkImage(buildDusk()), []);
  const { width, height } = useWindowDimensions();
  const ratio = PixelRatio.get();
  const scale = Math.ceil(Math.max((width * ratio) / DUSK_W, (height * ratio) / DUSK_H)) / ratio;
  const w = DUSK_W * scale;
  const h = DUSK_H * scale;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        image={image}
        x={(width - w) / 2}
        y={height - h}
        width={w}
        height={h}
        sampling={PIXEL_SAMPLING}
      />
    </Canvas>
  );
}
