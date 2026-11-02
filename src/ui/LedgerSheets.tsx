// M1 stand-ins for the History and Budget sheets (full versions are M2).

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCategory } from '@/domain/categories';
import { daysLeft, monthSpentMinor } from '@/domain/entries';
import { formatMoney } from '@/domain/money';
import { Tier } from '@/domain/reaction/tier';
import { useGame } from '@/store/game';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

const TAG: Record<Tier, string> = {
  approve: 'approved',
  neutral: 'filed',
  judge: 'judged',
  angry: 'yelled',
  meltdown: 'glass + call',
};

type SheetProps = { visible: boolean; onClose: () => void };

export function HistorySheet({ visible, onClose }: SheetProps) {
  const entries = useGame((s) => s.entries);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>History</Text>
      <ScrollView style={styles.list}>
        {entries.length === 0 && (
          <Text style={styles.empty}>No receipts yet. Vinnie is bored.</Text>
        )}
        {[...entries].reverse().map((e) => {
          const cat = getCategory(e.category);
          const sign = e.type === 'expense' ? '' : e.type === 'saved' ? 'saved ' : 'skipped ';
          return (
            <View key={e.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{e.description || cat.label}</Text>
                <Text style={styles.rowSub}>
                  {cat.label} · {e.date}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text style={styles.rowAmount}>
                  {sign}
                  {formatMoney(e.amountMinor)}
                </Text>
                <Text style={[styles.tag, e.tier === 'meltdown' && styles.tagHot]}>
                  {TAG[e.tier]}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const STEP = 5000;

export function BudgetSheet({ visible, onClose }: SheetProps) {
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const setLimit = useGame((s) => s.setLimit);
  const now = new Date();
  const spent = monthSpentMinor(entries, now);
  const left = daysLeft(now);
  const current = limit ?? 0;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Budget this month</Text>
      <View style={styles.stepper}>
        <StepButton label="−" onPress={() => setLimit(Math.max(0, current - STEP))} />
        <Text style={styles.limit}>{formatMoney(current, 'USD', { trimZeroCents: true })}</Text>
        <StepButton label="+" onPress={() => setLimit(current + STEP)} />
      </View>
      <View style={styles.stats}>
        <Stat label="Spent" value={formatMoney(spent)} />
        <Stat label="Left" value={formatMoney(Math.max(0, current - spent))} />
        <Stat label="Days left" value={String(left)} />
      </View>
      <Text style={styles.note}>
        Go over this number and Vinnie takes it personally. Very personally.
      </Text>
    </Sheet>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.step}
      accessibilityLabel={label === '+' ? 'Raise' : 'Lower'}
    >
      <Text style={styles.stepLabel}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: space.md },
  list: { maxHeight: 460 },
  empty: { color: colors.inkSoft, paddingVertical: space.xl, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '700', color: colors.ink },
  rowSub: { color: colors.inkSoft, fontSize: 12 },
  rowEnd: { alignItems: 'flex-end' },
  rowAmount: { fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  tag: { fontSize: 11, color: colors.inkSoft, fontWeight: '700' },
  tagHot: { color: colors.brick },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  step: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontSize: 26, fontWeight: '800', color: colors.ink },
  limit: { fontSize: 36, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  stat: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.md, padding: space.md },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 12, color: colors.inkSoft },
  note: { color: colors.inkSoft, textAlign: 'center', marginBottom: space.md },
});
