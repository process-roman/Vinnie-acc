// History (blueprint 2.2) and Budget (2.3) sheets.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { activeCategories, getCategory } from '@/domain/categories';
import { summarizeMonth } from '@/domain/budget';
import { dayLabel, filterEntries, groupByMonth } from '@/domain/history';
import { formatMoney, parseDecimalToMinor } from '@/domain/money';
import { Tier } from '@/domain/reaction/tier';
import { StoredEntry, useGame } from '@/store/game';

import { CategoryLimits } from './CategoryLimits';
import { Sheet } from './Sheet';
import { SpendingChart } from './SpendingChart';
import { colors, radius, space } from './tokens';

const TAG: Record<Tier, string> = {
  approve: 'approved',
  neutral: 'filed',
  judge: 'judged',
  angry: 'yelled',
  meltdown: 'glass + call',
};

type SheetProps = { visible: boolean; onClose: () => void };

export function HistorySheet({
  visible,
  onClose,
  onEdit,
}: SheetProps & { onEdit: (e: StoredEntry) => void }) {
  const entries = useGame((s) => s.entries);
  const removeExamples = useGame((s) => s.removeExamples);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'chart'>('list');
  const now = new Date();

  const groups = useMemo(
    () => groupByMonth(filterEntries(entries, { query, category })),
    [entries, query, category],
  );
  const hasExamples = entries.some((e) => e.isExample);
  const used = new Set(entries.map((e) => e.category));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>History</Text>
        {hasExamples && (
          <Pressable onPress={removeExamples} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Remove examples</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.viewTabs}>
        {(['list', 'chart'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[styles.viewTab, view === v && styles.viewTabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
          >
            <Text style={[styles.viewTabLabel, view === v && styles.viewTabLabelOn]}>
              {v === 'list' ? 'Receipts' : 'Where it went'}
            </Text>
          </Pressable>
        ))}
      </View>
      {view === 'chart' ? (
        <SpendingChart entries={entries} />
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search receipts"
            placeholderTextColor={colors.inkSoft}
            style={styles.search}
            clearButtonMode="while-editing"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            <FilterChip label="All" on={category === null} onPress={() => setCategory(null)} />
            {activeCategories()
              .filter((c) => used.has(c.id))
              .map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.label}
                  color={c.color}
                  on={category === c.id}
                  onPress={() => setCategory(category === c.id ? null : c.id)}
                />
              ))}
          </ScrollView>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {groups.length === 0 && (
              <Text style={styles.empty}>
                {entries.length ? 'Nothing matches.' : 'No receipts yet. Vinnie is bored.'}
              </Text>
            )}
            {groups.map((g) => (
              <View key={g.month}>
                <View style={styles.monthRow}>
                  <Text style={styles.month}>{g.label}</Text>
                  <Text style={styles.monthTotal}>{formatMoney(g.spentMinor)} spent</Text>
                </View>
                {g.entries.map((e) => (
                  <HistoryRow key={e.id} entry={e} now={now} onPress={() => onEdit(e)} />
                ))}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </Sheet>
  );
}

function HistoryRow({
  entry: e,
  now,
  onPress,
}: {
  entry: StoredEntry;
  now: Date;
  onPress: () => void;
}) {
  const cat = getCategory(e.category);
  const prefix = e.type === 'saved' ? 'Saved · ' : e.type === 'skipped' ? 'Skipped · ' : '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityHint="Edit this receipt"
    >
      <View style={[styles.dot, { backgroundColor: cat.color }]} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {e.description || cat.label}
        </Text>
        <Text style={styles.rowSub}>
          {prefix}
          {cat.label} · {dayLabel(e.date, now)}
          {e.isExample ? ' · example' : ''}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={[styles.rowAmount, e.type !== 'expense' && styles.good]}>
          {formatMoney(e.amountMinor)}
        </Text>
        {e.tier && (
          <Text style={[styles.tag, e.tier === 'meltdown' && styles.tagHot]}>{TAG[e.tier]}</Text>
        )}
      </View>
    </Pressable>
  );
}

function FilterChip(props: { label: string; color?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={[styles.filter, props.on && styles.filterOn]}>
      {props.color && <View style={[styles.dot, { backgroundColor: props.color }]} />}
      <Text style={[styles.filterLabel, props.on && styles.filterLabelOn]}>{props.label}</Text>
    </Pressable>
  );
}

const STEP = 5000;

const LEGEND = [
  ['🌿', 'The plant wilts as you near the limit.'],
  ['🌧', 'It rains outside at 85% spent.'],
  ['☕', 'The espresso poster cracks if you go over.'],
  ['🧾', 'One crumpled receipt per receipt Vinnie ate.'],
];

export function BudgetSheet({ visible, onClose }: SheetProps) {
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const setLimit = useGame((s) => s.setLimit);
  const [draft, setDraft] = useState<string | null>(null);
  const s = summarizeMonth(entries, limit, new Date());
  const current = limit ?? 0;
  const top = s.byCategory[0];

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseDecimalToMinor(draft);
    if (parsed !== null) setLimit(parsed);
    setDraft(null);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Budget this month</Text>
        <View style={styles.stepper}>
          <StepButton label="−" onPress={() => setLimit(Math.max(0, current - STEP))} />
          <TextInput
            value={draft ?? String(current / 100)}
            onFocus={() => setDraft(String(current / 100))}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            style={styles.limit}
            accessibilityLabel="Monthly budget in dollars"
            selectTextOnFocus
          />
          <StepButton label="+" onPress={() => setLimit(current + STEP)} />
        </View>

        <View style={styles.meter}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.min(100, (s.share ?? 0) * 100)}%`,
                backgroundColor:
                  (s.share ?? 0) > 1
                    ? colors.brick
                    : (s.share ?? 0) >= 0.85
                      ? colors.mustard
                      : colors.good,
              },
            ]}
          />
        </View>

        <View style={styles.stats}>
          <Stat label="Spent" value={formatMoney(s.spentMinor)} />
          <Stat label="Left" value={formatMoney(s.remainingMinor ?? 0)} />
          <Stat label="Per day" value={formatMoney(s.dailyAllowanceMinor ?? 0)} />
          <Stat label="Days left" value={String(s.daysLeft)} />
        </View>

        {top && (
          <Text style={styles.take}>
            Vinnie&apos;s take: “{formatMoney(top.totalMinor, 'USD', { trimZeroCents: true })} on{' '}
            {getCategory(top.category).label.toLowerCase()} this month. I&apos;m just saying.”
          </Text>
        )}

        {s.byCategory.length > 0 && <Text style={styles.section}>By category</Text>}
        {s.byCategory.map((c) => {
          const cat = getCategory(c.category);
          return (
            <View key={c.category} style={styles.catRow}>
              <View style={styles.catHead}>
                <Text style={styles.catLabel}>{cat.label}</Text>
                <Text style={styles.catAmount}>{formatMoney(c.totalMinor)}</Text>
              </View>
              <View style={styles.catTrack}>
                <View
                  style={[
                    styles.catFill,
                    { width: `${Math.max(2, c.share * 100)}%`, backgroundColor: cat.color },
                  ]}
                />
              </View>
            </View>
          );
        })}

        {(s.savedMinor > 0 || s.skippedMinor > 0) && (
          <Text style={styles.good}>
            Saved {formatMoney(s.savedMinor)} · Didn&apos;t spend {formatMoney(s.skippedMinor)}
          </Text>
        )}

        <CategoryLimits />

        <Text style={styles.section}>How to read the office</Text>
        {LEGEND.map(([icon, text]) => (
          <View key={text} style={styles.legendRow}>
            <Text style={styles.legendIcon}>{icon}</Text>
            <Text style={styles.legendText}>{text}</Text>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.step}
      accessibilityLabel={label === '+' ? 'Raise budget' : 'Lower budget'}
    >
      <Text style={styles.stepLabel}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: space.sm,
  },
  viewTab: { flex: 1, paddingVertical: space.sm, borderRadius: radius.sm, alignItems: 'center' },
  viewTabOn: { backgroundColor: colors.card },
  viewTabLabel: { color: colors.inkSoft, fontWeight: '600' },
  viewTabLabelOn: { color: colors.ink },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  textButton: { paddingVertical: 4, paddingHorizontal: space.sm },
  textButtonLabel: { color: colors.brick, fontWeight: '700' },
  search: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.ink,
    fontSize: 16,
  },
  filters: { flexGrow: 0, marginVertical: space.sm },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    marginRight: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterLabel: { color: colors.ink, fontWeight: '600' },
  filterLabelOn: { color: colors.card },
  list: { maxHeight: 440 },
  empty: { color: colors.inkSoft, paddingVertical: space.xl, textAlign: 'center' },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  month: { fontWeight: '800', color: colors.ink },
  monthTotal: { color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.paper },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '700', color: colors.ink },
  rowSub: { color: colors.inkSoft, fontSize: 12 },
  rowEnd: { alignItems: 'flex-end' },
  rowAmount: { fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  good: { color: colors.good, fontWeight: '700', marginVertical: space.sm },
  tag: { fontSize: 11, color: colors.inkSoft, fontWeight: '700' },
  tagHot: { color: colors.brick },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
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
  limit: {
    flex: 1,
    marginHorizontal: space.md,
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  meter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  meterFill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  stat: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.md, padding: space.sm },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.inkSoft },
  take: { color: colors.ink, fontStyle: 'italic', marginBottom: space.md },
  section: { fontWeight: '800', color: colors.ink, marginTop: space.md, marginBottom: space.sm },
  catRow: { marginBottom: space.sm },
  catHead: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { color: colors.ink, fontWeight: '600' },
  catAmount: { color: colors.ink, fontVariant: ['tabular-nums'] },
  catTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.paper,
    marginTop: 4,
    overflow: 'hidden',
  },
  catFill: { height: 6, borderRadius: 3 },
  legendRow: { flexDirection: 'row', gap: space.sm, marginBottom: 6 },
  legendIcon: { width: 22 },
  legendText: { flex: 1, color: colors.inkSoft },
});
