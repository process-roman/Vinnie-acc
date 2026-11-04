// The talking head from the opening scene. While he's talking his mouth flaps through its
// frames and his head bobs up and down, a whole art pixel at a time, like a 90s adventure game.

import { Canvas, Group, Image, rect } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { PixelRatio } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { PIXEL_SAMPLING, toSkImage } from './skiaImage';
import {
  buildPortraitBackground,
  buildPortraitBlink,
  buildPortraitBody,
  buildPortraitHeadSheet,
  PORTRAIT_MOUTHS,
  PORTRAIT_SIZE,
} from './sprites/portrait';

const S = PORTRAIT_SIZE;
/** Mouth frames in the order he flaps through them: uneven, so it reads as speech. */
const MOUTH_PATTERN = [1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 2, 1, 0, 1];
const MOUTH_MS = 85;
const BOB_PATTERN = [0, -1, -2, -1];
const BOB_MS = 150;
const BLINK_EVERY_MS = 3400;
const BLINK_MS = 130;

export function VinniePortrait({ size, talking }: { size: number; talking: boolean }) {
  const images = useMemo(
    () => ({
      background: toSkImage(buildPortraitBackground()),
      body: toSkImage(buildPortraitBody()),
      heads: toSkImage(buildPortraitHeadSheet()),
      blink: toSkImage(buildPortraitBlink()),
    }),
    [],
  );
  // Whole device pixels per art pixel, like the office.
  const ratio = PixelRatio.get();
  const scale = Math.max(1, Math.floor((size * ratio) / S)) / ratio;
  const reduced = useReducedMotion();

  const clock = useSharedValue(0);
  useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
  });
  const talk = useSharedValue(talking ? 1 : 0);
  useEffect(() => {
    talk.set(talking ? 1 : 0);
  }, [talking, talk]);

  const headY = useDerivedValue(() => {
    if (!talk.value || reduced) return 0;
    return BOB_PATTERN[Math.floor(clock.value / BOB_MS) % BOB_PATTERN.length];
  });
  const headX = useDerivedValue(() => {
    const mouth = talk.value
      ? MOUTH_PATTERN[Math.floor(clock.value / MOUTH_MS) % MOUTH_PATTERN.length]
      : 0;
    // Now and then, mid-sentence, the eyebrow goes up.
    const browUp = talk.value && Math.floor(clock.value / 1900) % 3 === 1 ? 1 : 0;
    return -(mouth + browUp * PORTRAIT_MOUTHS) * S;
  });
  const headClip = useDerivedValue(() => rect(0, 0, S, S));
  const blink = useDerivedValue(() => (clock.value % BLINK_EVERY_MS < BLINK_MS ? 1 : 0));

  const px = S * scale;
  return (
    <Canvas style={{ width: px, height: px }} accessibilityLabel="Vinnie, talking">
      <Group transform={[{ scale }]}>
        <Image
          image={images.background}
          x={0}
          y={0}
          width={S}
          height={S}
          sampling={PIXEL_SAMPLING}
        />
        <Image image={images.body} x={0} y={0} width={S} height={S} sampling={PIXEL_SAMPLING} />
        <Group clip={headClip}>
          <Image
            image={images.heads}
            x={headX}
            y={headY}
            width={images.heads.width()}
            height={S}
            sampling={PIXEL_SAMPLING}
          />
        </Group>
        <Image
          image={images.blink}
          x={0}
          y={headY}
          width={S}
          height={S}
          sampling={PIXEL_SAMPLING}
          opacity={blink}
        />
      </Group>
    </Canvas>
  );
}
