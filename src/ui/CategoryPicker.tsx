// Picks a category: most-used chips first, "More" for the rest, "+" to make a new one.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import limits from '@/content/limits.json';
import {
  activeCategories,
  CategoryKind,
  categoryNameProblem,
  MAX_CATEGORY_LABEL,
  pickerCategories,
} from '@/domain/categories';
import { suggestedLimit } from '@/domain/categoryLimits';
import { formatMoney, parseDecimalToMinor } from '@/domain/money';
import { fillPlaceholders } from '@/domain/reaction/dialogue';
import { useGame } from '@/store/game';

import { colors, radius, space } from './tokens';

const money = (m: number) => formatMoney(m, 'USD', { trimZeroCents: true });

export function CategoryPicker(props: { selected: string; onSelect: (id: string) => void }) {
  const entries = useGame((s) => s.entries);
  // Re-renders the picker when one's added or removed; the list itself comes from the domain.
  useGame((s) => s.customCategories);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.type === 'expense') counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const { shown, hidden } = pickerCategories(activeCategories(), usage, props.selected, expanded);

  if (adding) {
    return (
      <NewCategory
        onCancel={() => setAdding(false)}
        onAdded={(id) => {
          props.onSelect(id);
          setAdding(false);
        }}
      />
    );
  }

  return (
    <View style={styles.chips}>
      {shown.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => props.onSelect(c.id)}
          style={[styles.chip, props.selected === c.id && styles.chipOn]}
        >
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <Text style={[styles.chipLabel, props.selected === c.id && styles.chipLabelOn]}>
            {c.label}
          </Text>
        </Pressable>
      ))}
      {(hidden > 0 || expanded) && (
        <Pressable onPress={() => setExpanded(!expanded)} style={[styles.chip, styles.more]}>
          <Text style={styles.chipLabel}>{expanded ? 'Less' : `More (${hidden})`}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => setAdding(true)}
        style={[styles.chip, styles.more]}
        accessibilityLabel="Add a category"
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const KINDS: { id: CategoryKind; label: string }[] = [
  { id: 'essential', label: 'I need it' },
  { id: 'discretionary', label: 'I want it' },
];

function NewCategory(props: { onCancel: () => void; onAdded: (id: string) => void }) {
  const addCategory = useGame((s) => s.addCategory);
  const monthly = useGame((s) => s.limitMinor);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<CategoryKind>('discretionary');
  const [amount, setAmount] = useState('');
  const problem = categoryNameProblem(label);
  const suggestion = suggestedLimit(kind, monthly);
  const name = label.trim() || 'that';

  const add = () => {
    if (problem) return;
    props.onAdded(addCategory(label.trim(), kind, parseDecimalToMinor(amount)));
  };

  return (
    <View style={styles.form}>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="What do you call it?"
        placeholderTextColor={colors.inkSoft}
        style={styles.input}
        maxLength={MAX_CATEGORY_LABEL}
        autoFocus
        accessibilityLabel="Category name"
      />
      {problem === 'taken' && <Text style={styles.taken}>{limits.taken}</Text>}
      <View style={styles.segment}>
        {KINDS.map((k) => (
          <Pressable
            key={k.id}
            onPress={() => setKind(k.id)}
            style={[styles.segmentItem, kind === k.id && styles.segmentOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === k.id }}
          >
            <Text style={[styles.segmentLabel, kind === k.id && styles.segmentLabelOn]}>
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ask}>{fillPlaceholders(limits.ask, { name })}</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder={money(suggestion)}
        placeholderTextColor={colors.inkSoft}
        keyboardType="decimal-pad"
        style={styles.input}
        accessibilityLabel="How much is too much, in dollars"
      />
      <Text style={styles.hint}>
        {fillPlaceholders(limits.hint, { amount: money(suggestion) })}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={props.onCancel} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={add}
          disabled={!!problem}
          style={[styles.add, !!problem && styles.disabled]}
        >
          <Text style={styles.addLabel}>Add it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { color: colors.ink, fontWeight: '600' },
  chipLabelOn: { color: colors.card },
  more: { backgroundColor: colors.paper, borderColor: colors.paper },
  plus: { color: colors.ink, fontWeight: '800', fontSize: 16, lineHeight: 18 },
  form: {
    gap: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    color: colors.ink,
    fontSize: 16,
  },
  taken: { color: colors.brick, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.line,
    borderRadius: radius.md,
    padding: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.card },
  segmentLabel: { color: colors.inkSoft, fontWeight: '600' },
  segmentLabelOn: { color: colors.ink },
  ask: { color: colors.ink, fontWeight: '700' },
  hint: { color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  cancel: { flex: 1, paddingVertical: space.sm + 2, alignItems: 'center' },
  cancelLabel: { color: colors.inkSoft, fontWeight: '700' },
  add: {
    flex: 1,
    backgroundColor: colors.mustard,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    alignItems: 'center',
  },
  addLabel: { color: colors.ink, fontWeight: '800' },
  disabled: { opacity: 0.4 },
});
