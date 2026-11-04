// "Appease Vinnie" (blueprint Screen 5): gifts, office items, achievements.
// Coins only; nothing here costs real money.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '@/domain/achievements';
import { balance } from '@/domain/coins';
import { canBuy, GIFTS, ITEMS } from '@/domain/shop';
import { playSound } from '@/services/sound';
import { useGame } from '@/store/game';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

type Tab = 'gifts' | 'office' | 'achievements';
const TABS: { id: Tab; label: string }[] = [
  { id: 'gifts', label: 'Gifts' },
  { id: 'office', label: 'Office' },
  { id: 'achievements', label: 'Achievements' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with Vinnie's thank-you line after a purchase. */
  onBought: (line: string) => void;
};

export function ShopSheet({ visible, onClose, onBought }: Props) {
  const [tab, setTab] = useState<Tab>('gifts');
  const coins = useGame((s) => balance(s.coinTx));
  const inventory = useGame((s) => s.inventory);
  const achievements = useGame((s) => s.achievements);
  const buy = useGame((s) => s.buy);
  const toggleEquip = useGame((s) => s.toggleEquip);

  const purchase = (id: string) => {
    const line = buy(id);
    if (line) playSound('coin');
    if (line) onBought(line);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Appease Vinnie</Text>
        <Text style={styles.coins}>🪙 {coins}</Text>
      </View>
      <View style={styles.segment}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.segmentItem, tab === t.id && styles.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
          >
            <Text style={[styles.segmentLabel, tab === t.id && styles.segmentLabelOn]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.list}>
        {tab === 'gifts' && (
          <>
            <Text style={styles.note}>
              Treats lift his mood. They don&apos;t fix the glass. Only good habits do that.
            </Text>
            <View style={styles.grid}>
              {GIFTS.map((g) => {
                const ok = canBuy(g.id, coins, inventory).ok;
                return (
                  <View key={g.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    <Text style={styles.cardSub}>+{g.mood} mood</Text>
                    <PriceButton price={g.price} enabled={ok} onPress={() => purchase(g.id)} />
                  </View>
                );
              })}
            </View>
          </>
        )}

        {tab === 'office' &&
          ITEMS.map((item) => {
            const owned = inventory.find((o) => o.itemId === item.id);
            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>
                    {item.slot === 'outfit' ? 'Outfit' : 'Office'}
                    {owned ? (owned.equipped ? ' · in use' : ' · owned') : ''}
                  </Text>
                </View>
                {owned ? (
                  <Pressable
                    onPress={() => toggleEquip(item.id)}
                    style={[styles.equip, owned.equipped && styles.equipOn]}
                  >
                    <Text style={[styles.equipLabel, owned.equipped && styles.equipLabelOn]}>
                      {owned.equipped ? 'Put away' : 'Use'}
                    </Text>
                  </Pressable>
                ) : (
                  <PriceButton
                    price={item.price}
                    enabled={canBuy(item.id, coins, inventory).ok}
                    onPress={() => purchase(item.id)}
                  />
                )}
              </View>
            );
          })}

        {tab === 'achievements' &&
          ACHIEVEMENTS.map((a) => {
            const st = achievements[a.id];
            const done = !!st?.unlockedAt;
            const hidden = a.secret && !done;
            const progress = Math.min(a.goal, st?.progress ?? 0);
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.check}>{done ? '✅' : '⬜'}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle}>{hidden ? '???' : a.name}</Text>
                  <Text style={styles.cardSub}>{a.description}</Text>
                  {a.goal > 1 && !done && (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${(progress / a.goal) * 100}%` }]} />
                    </View>
                  )}
                </View>
                <Text style={[styles.reward, done && styles.rewardDone]}>+{a.coins}</Text>
              </View>
            );
          })}
      </ScrollView>
    </Sheet>
  );
}

function PriceButton(props: { price: number; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={!props.enabled}
      style={[styles.price, !props.enabled && styles.priceOff]}
      accessibilityLabel={`Buy for ${props.price} coins`}
    >
      <Text style={styles.priceLabel}>🪙 {props.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  coins: { fontSize: 16, fontWeight: '800', color: colors.ink },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: space.md,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentOn: { backgroundColor: colors.card },
  segmentLabel: { color: colors.inkSoft, fontWeight: '600' },
  segmentLabelOn: { color: colors.ink },
  list: { maxHeight: 460 },
  note: { color: colors.inkSoft, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  cardTitle: { fontWeight: '800', color: colors.ink },
  cardSub: { color: colors.inkSoft, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1, gap: 2 },
  check: { fontSize: 18 },
  reward: { fontWeight: '800', color: colors.inkSoft },
  rewardDone: { color: colors.good },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.paper, marginTop: 4 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.mustard },
  price: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    backgroundColor: colors.mustard,
    borderBottomWidth: 3,
    borderBottomColor: colors.mustardDark,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: space.md,
  },
  priceOff: { opacity: 0.4 },
  priceLabel: { fontWeight: '800', color: colors.ink },
  equip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
  },
  equipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  equipLabel: { fontWeight: '700', color: colors.ink },
  equipLabelOn: { color: colors.card },
});
