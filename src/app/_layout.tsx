import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { FxProvider, useFx } from '@/store/fx';
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
      {/* Last child: draws over every screen, sheet, bar and the call. */}
      <CrackOverlay />
    </>
  );
}

export default function RootLayout() {
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
