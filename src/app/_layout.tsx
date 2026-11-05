import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { FxProvider, useFx } from '@/store/fx';
import { announceDemoReady } from '@/services/demo';
import { configureNotifications, listenForTaps } from '@/services/notifications';
import { prepareSounds } from '@/services/sound';
import { useGame } from '@/store/game';
import { AchievementToast } from '@/ui/AchievementToast';
import { CallOverlay } from '@/ui/CallOverlay';
import { CrackOverlay } from '@/ui/CrackOverlay';
import { colors } from '@/ui/tokens';

function ShakingApp() {
  const { shakeX } = useFx();
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  return (
    <>
      <Animated.View style={[styles.fill, shakeStyle]}>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
        />
      </Animated.View>
      <CallOverlay />
      <AchievementToast />
      {/* Last child: draws over every screen, sheet, bar and the call. */}
      <CrackOverlay />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const game = useGame.getState();
    configureNotifications();
    prepareSounds();
    // Plan the week's notifications once everything has loaded.
    game.init().then(() => {
      useGame.getState().rescheduleNotifications();
      announceDemoReady();
    });
    return listenForTaps((t) => useGame.getState().notificationOpened(t));
  }, []);
  return (
    <FxProvider>
      <StatusBar style="dark" />
      <ShakingApp />
    </FxProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
});
