// Bottom sheet: backdrop plus a panel that slides up. It closes the ways people expect:
// a swipe down on its top bar, the close button, a tap outside, or the system back gesture.

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BackHandler, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
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

/** A drag further than this, or a quick flick, closes the sheet. */
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 0.8;

export function Sheet({ visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  // Stay mounted while the close animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, progress, drag]);

  // Android's back gesture closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch as soon as it lands on the bar, so nothing underneath (or a text
        // selection on web) takes it first. The close button, being deeper, still gets its taps.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => drag.set(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) onClose();
          else drag.set(withTiming(0, { duration: 160 }));
        },
        onPanResponderTerminate: () => drag.set(withTiming(0, { duration: 160 })),
      }),
    [drag, onClose],
  );

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() * 0.35 }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * 600 + drag.get() }],
  }));

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }, panel]}>
        {/* The top bar: swipe it down to close, or use the button. */}
        <View style={styles.bar} {...pan.panHandlers}>
          <View style={styles.grabber} />
          <Pressable
            onPress={onClose}
            style={styles.close}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>
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
  },
  bar: {
    height: 40,
    userSelect: 'none',
    marginHorizontal: -space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  close: {
    position: 'absolute',
    right: space.md,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: colors.inkSoft, fontSize: 14, fontWeight: '800' },
});
