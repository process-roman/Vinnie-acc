// "Achievement: Picked Up +30" (blueprint 6.2). Shows unlocks one at a time.

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { playSound } from '@/services/sound';
import { useGame } from '@/store/game';

import { colors, radius, space } from './tokens';

const SHOW_MS = 2800;

export function AchievementToast() {
  const toast = useGame((s) => s.toasts[0]);
  const dismiss = useGame((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    playSound('coin');
    const id = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="none">
      <Animated.View
        key={toast.id}
        entering={FadeInUp}
        exiting={FadeOutUp}
        style={styles.toast}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.trophy}>🏆</Text>
        <View style={styles.main}>
          <Text style={styles.kicker}>Achievement</Text>
          <Text style={styles.name}>{toast.name}</Text>
        </View>
        <Text style={styles.coins}>+{toast.coins} 🪙</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  trophy: { fontSize: 22 },
  main: { flex: 1 },
  kicker: { color: colors.mustard, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  name: { color: colors.card, fontSize: 16, fontWeight: '800' },
  coins: { color: colors.mustard, fontWeight: '800' },
});
