// Where the money went: a pixel-art pie with a percent for every slice, by month or all time.
// The list under the pie carries the names and numbers, so nothing depends on telling
// colours apart. Tap a slice or a row to pick it out.

import { Canvas, Group, Image } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Entry } from '@/domain/entries';
import { formatMoney } from '@/domain/money';
import { Slice, sliceAt, spendingBreakdown, spendingMonths } from '@/domain/spending';
import { PIE_INNER, PIE_OUTER, PIE_SIZE, rasterizePie } from '@/scene/pie';
import { PIXEL_SAMPLING, toSkImage } from '@/scene/skiaImage';

import { colors, radius, space } from './tokens';

const money = (m: number) => formatMoney(m, 'USD', { trimZeroCents: true });
const percentLabel = (s: Slice) => (s.percent === 0 ? '<1%' : `${s.percent}%`);

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function SpendingChart({ entries }: { entries: readonly Entry[] }) {
  const months = useMemo(() => spendingMonths(entries), [entries]);
  // The picked month, or null for all time. Starts on the latest month with spending.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const month = picked === undefined ? (months[0] ?? null) : picked;
  const [selected, setSelected] = useState<string | null>(null);
  const breakdown = useMemo(() => spendingBreakdown(entries, month), [entries, month]);
  const chosen = breakdown.slices.find((s) => s.id === selected) ?? null;

  const goTo = (next: string | null) => {
    setPicked(next);
    setSelected(null);
  };
  const index = month ? months.indexOf(month) : -1;

  if (!months.length) {
    return <Text style={styles.empty}>Nothing spent yet. Vinnie&apos;s almost impressed.</Text>;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.nav}>
        <NavButton
          label="‹"
          name="Older month"
          disabled={month === null || index >= months.length - 1}
          onPress={() => goTo(months[index + 1])}
        />
        <Text style={styles.navLabel}>{month ? monthLabel(month) : 'All time'}</Text>
        <NavButton
          label="›"
          name="Newer month"
          disabled={month === null || index <= 0}
          onPress={() => goTo(months[index - 1])}
        />
        <Pressable
          onPress={() => goTo(month === null ? months[0] : null)}
          style={[styles.allTime, month === null && styles.allTimeOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: month === null }}
        >
          <Text style={[styles.allTimeLabel, month === null && styles.allTimeLabelOn]}>
            All time
          </Text>
        </Pressable>
      </View>

      <Pie
        slices={breakdown.slices}
        selected={chosen?.id ?? null}
        total={breakdown.totalMinor}
        onPick={(s) => setSelected(s && s.id !== selected ? s.id : null)}
      />

      <View>
        {breakdown.slices.map((s) => {
          const on = s.id === selected;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSelected(on ? null : s.id)}
              style={[styles.row, on && styles.rowOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.label}, ${money(s.totalMinor)}, ${percentLabel(s)}`}
            >
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.rowLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.rowAmount}>{money(s.totalMinor)}</Text>
              <Text style={styles.rowPercent}>{percentLabel(s)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Pie(props: {
  slices: Slice[];
  selected: string | null;
  total: number;
  onPick: (s: Slice | null) => void;
}) {
  const { slices, selected, total, onPick } = props;
  const image = useMemo(() => toSkImage(rasterizePie(slices, selected)), [slices, selected]);
  // Whole device pixels per art pixel, like the office.
  const ratio = PixelRatio.get();
  const scale = Math.max(1, Math.floor((230 * ratio) / PIE_SIZE)) / ratio;
  const size = PIE_SIZE * scale;
  const chosen = slices.find((s) => s.id === selected);

  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    // Not reported on web when the target is the canvas; the rows below still work there.
    if (typeof locationX !== 'number' || typeof locationY !== 'number') return;
    onPick(
      sliceAt(
        slices,
        locationX / scale - PIE_SIZE / 2,
        locationY / scale - PIE_SIZE / 2,
        PIE_INNER,
        PIE_OUTER,
      ),
    );
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.pie, { width: size, height: size }]}
      accessibilityLabel={`Spending: ${slices
        .map((s) => `${s.label} ${percentLabel(s)}`)
        .join(', ')}`}
    >
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <Group transform={[{ scale }]}>
          <Image
            image={image}
            x={0}
            y={0}
            width={PIE_SIZE}
            height={PIE_SIZE}
            sampling={PIXEL_SAMPLING}
          />
        </Group>
      </Canvas>
      <View style={styles.centre} pointerEvents="none">
        {chosen ? (
          <>
            <Text style={styles.centreBig}>{percentLabel(chosen)}</Text>
            <Text style={styles.centreSmall} numberOfLines={2}>
              {chosen.label}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.centreBig} numberOfLines={1} adjustsFontSizeToFit>
              {money(total)}
            </Text>
            <Text style={styles.centreSmall}>spent</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

function NavButton(props: { label: string; name: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[styles.navButton, props.disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={props.name}
    >
      <Text style={styles.navButtonLabel}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  body: { gap: space.md, paddingBottom: space.lg },
  empty: { color: colors.inkSoft, textAlign: 'center', padding: space.xl },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navLabel: { flex: 1, textAlign: 'center', fontWeight: '800', color: colors.ink, fontSize: 16 },
  navButton: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonLabel: { fontSize: 22, fontWeight: '800', color: colors.ink },
  disabled: { opacity: 0.35 },
  allTime: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  allTimeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  allTimeLabel: { color: colors.ink, fontWeight: '700' },
  allTimeLabelOn: { color: colors.card },
  pie: { alignSelf: 'center' },
  centre: {
    position: 'absolute',
    top: '32%',
    bottom: '32%',
    left: '24%',
    right: '24%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreBig: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  centreSmall: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowOn: { backgroundColor: colors.paper },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  rowLabel: { flex: 1, color: colors.ink, fontWeight: '700' },
  rowAmount: { color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  rowPercent: {
    minWidth: 44,
    textAlign: 'right',
    color: colors.ink,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
