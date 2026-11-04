// The budget sheet's list of where Vinnie draws the line, category by category.
// Tap one to set your own number, hand it back to him, or remove a category you added.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import limits from '@/content/limits.json';
import { activeCategories, Category } from '@/domain/categories';
import { categoryLimit, CategoryLimit } from '@/domain/categoryLimits';
import { formatMoney, parseDecimalToMinor } from '@/domain/money';
import { useGame } from '@/store/game';

import { colors, radius, space } from './tokens';

const COLLAPSED = 5;
const SOURCE: Record<CategoryLimit['source'], string> = {
  yours: limits.sourceYours,
  learned: limits.sourceLearned,
  vinnie: limits.sourceVinnie,
};

export function CategoryLimits() {
  const entries = useGame((s) => s.entries);
  const monthly = useGame((s) => s.limitMinor);
  const userLimits = useGame((s) => s.categoryLimits);
  // Re-renders when one's added or removed; the list itself comes from the domain.
  useGame((s) => s.customCategories);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const all = activeCategories();
  const shown = showAll ? all : all.slice(0, COLLAPSED);
  return (
    <>
      <Text style={styles.section}>Where Vinnie loses it</Text>
      <Text style={styles.intro}>{limits.intro}</Text>
      {shown.map((c) => {
        const limit = categoryLimit(c, {
          userLimitMinor: userLimits[c.id],
          monthlyLimitMinor: monthly,
          history: entries
            .filter((e) => e.type === 'expense' && e.category === c.id)
            .map((e) => e.amountMinor),
        });
        return editing === c.id ? (
          <EditLimit key={c.id} category={c} limit={limit} onDone={() => setEditing(null)} />
        ) : (
          <Pressable
            key={c.id}
            onPress={() => setEditing(c.id)}
            style={styles.row}
            accessibilityLabel={`${c.label}, limit ${formatMoney(limit.limitMinor)}. Change it.`}
          >
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <View style={styles.rowMain}>
              <Text style={styles.label}>{c.label}</Text>
              <Text style={styles.source}>{SOURCE[limit.source]}</Text>
            </View>
            <Text style={styles.amount}>
              {formatMoney(limit.limitMinor, 'USD', { trimZeroCents: true })}
            </Text>
          </Pressable>
        );
      })}
      {all.length > COLLAPSED && (
        <Pressable onPress={() => setShowAll(!showAll)} style={styles.more}>
          <Text style={styles.moreLabel}>{showAll ? 'Show fewer' : `Show all ${all.length}`}</Text>
        </Pressable>
      )}
    </>
  );
}

function EditLimit(props: { category: Category; limit: CategoryLimit; onDone: () => void }) {
  const { category, limit, onDone } = props;
  const setCategoryLimit = useGame((s) => s.setCategoryLimit);
  const removeCategory = useGame((s) => s.removeCategory);
  const [draft, setDraft] = useState(String(limit.limitMinor / 100));
  const minor = parseDecimalToMinor(draft);
  return (
    <View style={styles.edit}>
      <Text style={styles.label}>{category.label}: too much is over</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        keyboardType="decimal-pad"
        style={styles.input}
        autoFocus
        selectTextOnFocus
        accessibilityLabel={`Limit for ${category.label} in dollars`}
      />
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            if (minor) setCategoryLimit(category.id, minor);
            onDone();
          }}
          disabled={!minor}
          style={[styles.save, !minor && styles.disabled]}
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
        {limit.source === 'yours' && (
          <Pressable
            onPress={() => {
              setCategoryLimit(category.id, null);
              onDone();
            }}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>Let Vinnie decide</Text>
          </Pressable>
        )}
        {category.custom && (
          <Pressable
            onPress={() => {
              removeCategory(category.id);
              onDone();
            }}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, styles.remove]}>Remove</Text>
          </Pressable>
        )}
        <Pressable onPress={onDone} style={styles.action}>
          <Text style={styles.actionLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.inkSoft,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  intro: { color: colors.inkSoft, marginBottom: space.sm, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowMain: { flex: 1 },
  label: { color: colors.ink, fontWeight: '700' },
  source: { color: colors.inkSoft, fontSize: 12 },
  amount: { color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
  more: { alignSelf: 'center', padding: space.sm },
  moreLabel: { color: colors.inkSoft, fontWeight: '700', textDecorationLine: 'underline' },
  edit: {
    gap: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    marginVertical: space.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    color: colors.ink,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  save: {
    backgroundColor: colors.mustard,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  saveLabel: { color: colors.ink, fontWeight: '800' },
  action: { paddingVertical: space.sm, paddingHorizontal: space.sm },
  actionLabel: { color: colors.inkSoft, fontWeight: '700' },
  remove: { color: colors.brick },
  disabled: { opacity: 0.4 },
});
