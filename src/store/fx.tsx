// Screen-level effects: the camera shake and haptics. The crack itself lives in the
// game store (it's saved, and only good habits repair it).

import * as Haptics from 'expo-haptics';
import { createContext, ReactNode, useContext, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';
import { SharedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import type { Point } from '@/scene/iso';

import { useGame } from './game';

type Fx = {
  shakeX: SharedValue<number>;
  /** He punches the glass at a window point: shake, haptics, and the crack gets worse. */
  punch(at: Point): void;
  /** Gentle heat, or slamming the desk: a small shake, no crack. */
  knock(): void;
};

const FxContext = createContext<Fx | null>(null);

function shake(x: SharedValue<number>, strength = 1) {
  const d = 45;
  x.value = withSequence(
    ...[-10, 9, -7, 5, -2, 0].map((v) => withTiming(v * strength, { duration: d })),
  );
}

export function FxProvider({ children }: { children: ReactNode }) {
  const shakeX = useSharedValue(0);

  const value = useMemo<Fx>(
    () => ({
      shakeX,
      punch(at) {
        const { width, height } = Dimensions.get('window');
        useGame.getState().crackGlass({ x: at.x / width, y: at.y / height });
        shake(shakeX);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      },
      knock() {
        shake(shakeX, 0.3);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    }),
    [shakeX],
  );

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx(): Fx {
  const fx = useContext(FxContext);
  if (!fx) throw new Error('useFx must be used inside FxProvider');
  return fx;
}
