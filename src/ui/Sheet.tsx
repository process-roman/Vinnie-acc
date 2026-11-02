// Minimal bottom sheet: backdrop plus a panel that slides up. Swap for a full
// sheet library (drag to dismiss, snap points) when M2 needs it.

import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from './tokens';

type Props = { visible: boolean; onClose: () => void; children: ReactNode };

export function Sheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  // Stay mounted while the close animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 600 }],
  }));

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }, panel]}>
        <View style={styles.grabber} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: space.md,
  },
});
