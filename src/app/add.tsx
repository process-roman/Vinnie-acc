// Quick-add deep link: vinnie://add?amount=12.50&merchant=Starbucks&category=coffee
// (blueprint 2.5). Hands the parsed values to the Office, which opens a
// pre-filled receipt, then goes home. Bad parameters are ignored.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseQuickAdd } from '@/domain/quickAdd';
import { useGame } from '@/store/game';
import { colors } from '@/ui/tokens';

export default function QuickAddRoute() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const game = useGame.getState();
    game
      .init()
      .then(() => game.setPrefill(parseQuickAdd(params)))
      .finally(() => router.replace('/'));
    // Runs once per link; params don't change while this screen is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.paper } });
