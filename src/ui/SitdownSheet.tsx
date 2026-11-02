// The weekly sit-down (blueprint §9, 7.2): Vinnie walks you through your week,
// line by line, then pays you for showing up.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import sitdown from '@/content/sitdown.json';
import { getCategory } from '@/domain/categories';
import { formatMoney } from '@/domain/money';
import { fillPlaceholders } from '@/domain/reaction/dialogue';
import { SITDOWN_COINS, weeklyReview } from '@/domain/sitdown';
import { VinnieAvatar } from '@/scene/VinnieAvatar';
import { useGame } from '@/store/game';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

type Props = { visible: boolean; onClose: () => void; onDone: () => void };

const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)];

export function SitdownSheet({ visible, onClose, onDone }: Props) {
  const entries = useGame((s) => s.entries);
  const ledger = useGame((s) => s.ledger);
  const complete = useGame((s) => s.completeSitdown);
  const [step, setStep] = useState(0);

  // Lines are picked once per opening so they don't change as you read.
  const lines = useMemo(() => {
    const r = weeklyReview(entries, ledger, new Date());
    const money = (m: number) => formatMoney(m, 'USD', { trimZeroCents: true });
    const what = (e: NonNullable<typeof r.best>) =>
      e.description || getCategory(e.category).label.toLowerCase();
    const out = [pick(sitdown.open)];
    out.push(
      r.count
        ? fillPlaceholders(pick(sitdown.spent), { spent: money(r.spentMinor), count: r.count })
        : pick(sitdown.spentNone),
    );
    if (r.topCategory) {
      out.push(
        fillPlaceholders(pick(sitdown.top), {
          topCategory: getCategory(r.topCategory.category).label.toLowerCase(),
          topTotal: money(r.topCategory.totalMinor),
        }),
      );
    }
    if (r.best) {
      out.push(
        fillPlaceholders(pick(sitdown.best), {
          bestWhat: what(r.best),
          bestAmount: money(r.best.amountMinor),
        }),
      );
    }
    if (r.worst && r.worst.id !== r.best?.id) {
      out.push(
        fillPlaceholders(pick(sitdown.worst), {
          worstWhat: what(r.worst),
          worstAmount: money(r.worst.amountMinor),
        }),
      );
    }
    if (r.promisesKept) {
      out.push(
        fillPlaceholders(pick(sitdown.promisesKept), {
          kept: r.promisesKept,
          keptS: r.promisesKept === 1 ? '' : 's',
        }),
      );
    }
    if (r.promisesBroken) {
      out.push(
        fillPlaceholders(pick(sitdown.promisesBroken), {
          broken: r.promisesBroken,
          brokenS: r.promisesBroken === 1 ? '' : 's',
        }),
      );
    }
    out.push(pick(sitdown.close));
    return out;
    // Recomputed each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const last = step >= lines.length - 1;
  const next = () => {
    if (!last) return setStep(step + 1);
    complete();
    setStep(0);
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>The Sit-Down</Text>
      <View style={styles.speech}>
        <View style={styles.avatar}>
          <VinnieAvatar size={48} />
        </View>
        <Text style={styles.line} accessibilityLiveRegion="polite">
          {lines[step]}
        </Text>
      </View>
      <View style={styles.dots}>
        {lines.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>
      <Pressable onPress={next} style={styles.button}>
        <Text style={styles.buttonLabel}>{last ? `Collect 🪙 ${SITDOWN_COINS}` : 'Next'}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: space.md },
  speech: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: 110 },
  avatar: { backgroundColor: '#3A2E28', borderRadius: radius.sm, padding: 4, overflow: 'hidden' },
  line: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink, lineHeight: 25 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.mustard },
  button: {
    backgroundColor: colors.mustard,
    borderBottomColor: colors.mustardDark,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
