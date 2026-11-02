// New Receipt sheet (blueprint Screen 2), M1 version: no date picker yet (always today).

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES } from '@/domain/categories';
import { EntryType } from '@/domain/entries';
import { formatMoney, keypadToMinor, pressKey } from '@/domain/money';
import { NewEntry } from '@/domain/reaction/react';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

const TYPES: { id: EntryType; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'saved', label: 'Saved' },
  { id: 'skipped', label: 'Skipped it' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (entry: NewEntry) => void;
};

export function ReceiptSheet({ visible, onClose, onSubmit }: Props) {
  const [type, setType] = useState<EntryType>('expense');
  const [digits, setDigits] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('coffee');

  const amountMinor = keypadToMinor(digits);
  const needsCategory = type !== 'saved';

  const submit = () => {
    if (amountMinor <= 0) return;
    onSubmit({
      type,
      amountMinor,
      category: needsCategory ? category : 'other',
      description: description.trim(),
    });
    // Keep the type and category: the next receipt is often the same kind.
    setDigits('');
    setDescription('');
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
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

        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setDigits((d) => pressKey(d, k))}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              accessibilityLabel={k === 'back' ? 'Delete' : k}
            >
              <Text style={styles.keyLabel}>{k === 'back' ? '⌫' : k}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={submit}
          disabled={amountMinor === 0}
          style={[styles.submit, amountMinor === 0 && styles.submitDisabled]}
        >
          <Text style={styles.submitLabel}>Give Vinnie the Receipt</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
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
  submitDisabled: { opacity: 0.45 },
  submitLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
