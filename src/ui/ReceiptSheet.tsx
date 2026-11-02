// New / Edit Receipt sheet (blueprint Screen 2). The parent remounts it (via `key`)
// for each new receipt or edit, so its state always starts from `initial`.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES } from '@/domain/categories';
import { EntryType, toDateKey } from '@/domain/entries';
import { dayLabel } from '@/domain/history';
import { formatMoney, keypadToMinor, minorToKeypad, pressKey } from '@/domain/money';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

const TYPES: { id: EntryType; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'saved', label: 'Saved' },
  { id: 'skipped', label: 'Skipped it' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];

export type ReceiptValues = {
  type: EntryType;
  amountMinor: number;
  category: string;
  description: string;
  date: string;
};

type Props = {
  visible: boolean;
  mode: 'new' | 'edit';
  initial: Partial<ReceiptValues> & { category: string };
  onClose: () => void;
  onSubmit: (values: ReceiptValues) => void;
  onDelete?: () => void;
};

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

export function ReceiptSheet({ visible, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const today = toDateKey(new Date());
  const [type, setType] = useState<EntryType>(initial.type ?? 'expense');
  const [digits, setDigits] = useState(minorToKeypad(initial.amountMinor ?? 0));
  const [description, setDescription] = useState(initial.description ?? '');
  const [category, setCategory] = useState(initial.category);
  const [date, setDate] = useState(initial.date ?? today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amountMinor = keypadToMinor(digits);
  const needsCategory = type !== 'saved';

  const submit = () => {
    if (amountMinor <= 0) return;
    onSubmit({
      type,
      amountMinor,
      category: needsCategory ? category : 'other',
      description: description.trim(),
      date,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{mode === 'edit' ? 'Edit receipt' : 'New receipt'}</Text>
          {mode === 'edit' && onDelete && (
            <Pressable
              onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              style={[styles.delete, confirmDelete && styles.deleteConfirm]}
            >
              <Text style={[styles.deleteLabel, confirmDelete && styles.deleteLabelConfirm]}>
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.segment}>
          {TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setType(t.id)}
              style={[styles.segmentItem, type === t.id && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: type === t.id }}
            >
              <Text style={[styles.segmentLabel, type === t.id && styles.segmentLabelOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.amount, amountMinor === 0 && styles.amountEmpty]}>
          {formatMoney(amountMinor)}
        </Text>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={
            type === 'saved'
              ? 'Where did it go? e.g. emergency fund'
              : type === 'skipped'
                ? 'What did you walk away from?'
                : "What'd you buy? e.g. latte to go"
          }
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          maxLength={60}
        />

        {needsCategory && (
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.chip, category === c.id && styles.chipOn]}
              >
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={[styles.chipLabel, category === c.id && styles.chipLabelOn]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.dateRow}>
          <Pressable
            onPress={() => setDate((d) => shiftDate(d, -1))}
            style={styles.dateStep}
            accessibilityLabel="Previous day"
          >
            <Text style={styles.dateStepLabel}>‹</Text>
          </Pressable>
          <Text style={styles.dateLabel}>{dayLabel(date, new Date())}</Text>
          <Pressable
            onPress={() => setDate((d) => shiftDate(d, 1))}
            disabled={date >= today}
            style={[styles.dateStep, date >= today && styles.disabled]}
            accessibilityLabel="Next day"
          >
            <Text style={styles.dateStepLabel}>›</Text>
          </Pressable>
        </View>

        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setDigits((d) => pressKey(d, k))}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              accessibilityLabel={k === 'back' ? 'Delete digit' : k}
            >
              <Text style={styles.keyLabel}>{k === 'back' ? '⌫' : k}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={submit}
          disabled={amountMinor === 0}
          style={[styles.submit, amountMinor === 0 && styles.disabled]}
        >
          <Text style={styles.submitLabel}>
            {mode === 'edit' ? 'Save changes' : 'Give Vinnie the Receipt'}
          </Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  delete: { paddingVertical: 6, paddingHorizontal: space.md, borderRadius: radius.pill },
  deleteConfirm: { backgroundColor: colors.brick },
  deleteLabel: { color: colors.brick, fontWeight: '700' },
  deleteLabelConfirm: { color: colors.card },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 4,
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
  amount: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  amountEmpty: { color: colors.line },
  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.ink,
    fontSize: 16,
  },
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
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  dateStep: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateStepLabel: { fontSize: 22, fontWeight: '800', color: colors.ink },
  dateLabel: { minWidth: 120, textAlign: 'center', fontWeight: '700', color: colors.ink },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  key: {
    width: '31.5%',
    flexGrow: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    alignItems: 'center',
  },
  keyPressed: { backgroundColor: colors.line },
  keyLabel: { fontSize: 22, fontWeight: '700', color: colors.ink },
  submit: {
    backgroundColor: colors.mustard,
    borderBottomColor: colors.mustardDark,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  submitLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
