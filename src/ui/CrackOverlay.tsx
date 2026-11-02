// The cracked glass (blueprint 4.1). Mounted last in the root layout so it covers
// every screen, sheet and bar. It never takes touches. Saved, so it survives restarts.

import { Canvas, Image } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { rasterizeCrack } from '@/scene/crack';
import { PIXEL_SAMPLING, toSkImage } from '@/scene/skiaImage';
import { useGame } from '@/store/game';

/** Screen points per crack pixel. Matches the office's chunky pixel scale. */
const PIXEL = 3;

export function CrackOverlay() {
  const crackLevel = useGame((s) => s.character.crackLevel);
  const impact = useGame((s) => s.character.impact);
  const crackSeed = useGame((s) => s.character.crackSeed);
  const { width, height } = useWindowDimensions();
  const w = Math.ceil(width / PIXEL);
  const h = Math.ceil(height / PIXEL);

  const image = useMemo(() => {
    if (crackLevel === 0) return null;
    // The impact is stored as a fraction of the window.
    const at = impact ? { x: impact.x * w, y: impact.y * h } : undefined;
    return toSkImage(rasterizeCrack(crackLevel, w, h, crackSeed, at));
  }, [crackLevel, impact, crackSeed, w, h]);

  // Reduce Motion: the crack fades in instead of appearing with a jolt.
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduced || crackLevel === 0) return;
    opacity.set(0);
    opacity.set(withTiming(1, { duration: 600 }));
  }, [crackLevel, reduced, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (!image) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
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
    </Animated.View>
  );
}
