// Crack overlay spike (M0 / blueprint 0.3). Mounted last in the root layout so it
// covers every screen, sheet and bar. It never takes touches.

import { Canvas, Image } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { rasterizeCrack } from '@/scene/crack';
import { PIXEL_SAMPLING, toSkImage } from '@/scene/skiaImage';
import { useFx } from '@/store/fx';

/** Screen points per crack pixel. Matches the office's chunky pixel scale. */
const PIXEL = 3;

export function CrackOverlay() {
  const { crackLevel, impact, crackSeed } = useFx();
  const { width, height } = useWindowDimensions();
  const w = Math.ceil(width / PIXEL);
  const h = Math.ceil(height / PIXEL);

  const image = useMemo(() => {
    if (crackLevel === 0) return null;
    const at = impact ? { x: impact.x / PIXEL, y: impact.y / PIXEL } : undefined;
    return toSkImage(rasterizeCrack(crackLevel, w, h, crackSeed, at));
  }, [crackLevel, impact, crackSeed, w, h]);

  if (!image) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          image={image}
          x={0}
          y={0}
          width={w * PIXEL}
          height={h * PIXEL}
          sampling={PIXEL_SAMPLING}
          opacity={0.85}
        />
      </Canvas>
    </View>
  );
}
