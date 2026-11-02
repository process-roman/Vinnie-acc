// Screen-level effects that sit above the whole app: the glass crack and the
// camera shake. Crack persistence and cooldowns come later (blueprint 5.1).

import * as Haptics from 'expo-haptics';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { SharedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import type { CrackLevel } from '@/scene/crack';
import type { Point } from '@/scene/iso';

type Fx = {
  crackLevel: CrackLevel;
  /** Impact point in window coordinates, or null for the default. */
  impact: Point | null;
  /** Seed for the crack shape; a fully repaired screen gets a new one next time. */
  crackSeed: number;
  shakeX: SharedValue<number>;
  punch(at?: Point): void;
  repair(): void;
};

const FxContext = createContext<Fx | null>(null);

function shake(x: SharedValue<number>) {
  const d = 45;
  x.value = withSequence(
    withTiming(-10, { duration: d }),
    withTiming(9, { duration: d }),
    withTiming(-7, { duration: d }),
    withTiming(5, { duration: d }),
    withTiming(-2, { duration: d }),
    withTiming(0, { duration: d }),
  );
}

export function FxProvider({ children }: { children: ReactNode }) {
  const [crackLevel, setCrackLevel] = useState<CrackLevel>(0);
  const [impact, setImpact] = useState<Point | null>(null);
  const [crackSeed, setCrackSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const shakeX = useSharedValue(0);

  const value = useMemo<Fx>(
    () => ({
      crackLevel,
      impact,
      crackSeed,
      shakeX,
      punch(at) {
        // Keep the first impact point so the crack grows from the same spot.
        if (crackLevel === 0) setImpact(at ?? null);
        setCrackLevel((l) => Math.min(3, l + 1) as CrackLevel);
        shake(shakeX);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      },
      repair() {
        setCrackLevel((l) => {
          const next = Math.max(0, l - 1) as CrackLevel;
          if (next === 0) setCrackSeed(Math.floor(Math.random() * 1e9));
          return next;
        });
      },
    }),
    [crackLevel, impact, crackSeed, shakeX],
  );

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx(): Fx {
  const fx = useContext(FxContext);
  if (!fx) throw new Error('useFx must be used inside FxProvider');
  return fx;
}
