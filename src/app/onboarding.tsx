// Onboarding (blueprint §10, 8.1): meet Vinnie, pick a heat level, set a budget,
// give him a first receipt. The scripted first meltdown, repair preview, shop intro
// and the notification ask then play out in the office.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import onboarding from '@/content/onboarding.json';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { formatMoney, parseDecimalToMinor } from '@/domain/money';
import { Heat } from '@/domain/reaction/dialogue';
import { VinnieAvatar } from '@/scene/VinnieAvatar';
import { track } from '@/services/analytics';
import { useGame } from '@/store/game';
import { colors, radius, space } from '@/ui/tokens';

type Step = 'meet' | 'heat' | 'budget' | 'receipt';

const HEATS: { id: Heat; name: string; sample: string }[] = [
  {
    id: 'gentle',
    name: 'Gentle',
    sample: '"Let\'s slow down a little, alright?" No shouting, no punches.',
  },
  {
    id: 'classic',
    name: 'Classic',
    sample: '"We had a NUMBER. We had an AGREEMENT." Shouting, cracks, calls.',
  },
  {
    id: 'unhinged',
    name: 'Unhinged',
    sample: 'Classic plus the words his mother hates. 17+ only.',
  },
];
const BUDGETS = [150000, 200000, 300000];

export default function Onboarding() {
  const game = useGame.getState;
  const heat = useGame((s) => s.heat);
  const [step, setStep] = useState<Step>('meet');
  const [budget, setBudget] = useState('2000');
  const [adult, setAdult] = useState(false);
  const [real, setReal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('coffee');
  const [description, setDescription] = useState('');

  const go = (next: Step) => {
    track('onboarding_step', { step: next });
    setStep(next);
  };

  const pickHeat = (h: Heat) => {
    if (h === 'unhinged' && !adult) return;
    game().setHeat(h);
  };

  const saveBudget = (skip = false) => {
    const minor = skip ? null : parseDecimalToMinor(budget);
    if (minor) game().setLimit(minor);
    go('receipt');
  };

  /** Hands over to the office, which plays the first reaction. */
  const finish = (kind: 'example' | 'real') => {
    const ex = onboarding.example;
    const input =
      kind === 'example'
        ? {
            type: 'expense' as const,
            amountMinor: ex.amountMinor,
            category: ex.category,
            description: ex.description,
          }
        : {
            type: 'expense' as const,
            amountMinor: parseDecimalToMinor(amount) ?? 0,
            category,
            description: description.trim(),
          };
    if (input.amountMinor <= 0) return;
    // The scripted meltdown plays for the example, or a real treat; essentials just get approved.
    const scripted = kind === 'example' || getCategory(input.category).kind !== 'essential';
    game().startOnboardingScript(input, { isExample: kind === 'example', scripted });
    // Done from here on: if the app closes mid-meltdown, the receipt isn't logged twice.
    game().completeOnboarding();
    track('onboarding_step', { step: 'meltdown' });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.vinnie}>
          <View style={styles.avatar}>
            <VinnieAvatar size={96} />
          </View>
          <View style={styles.bubble}>
            <Text style={styles.say}>{onboarding[step]}</Text>
          </View>
        </View>

        {step === 'meet' && <Primary label="Nice to meet you" onPress={() => go('heat')} />}

        {step === 'heat' && (
          <>
            {HEATS.map((h) => {
              const locked = h.id === 'unhinged' && !adult;
              return (
                <Pressable
                  key={h.id}
                  onPress={() => pickHeat(h.id)}
                  style={[styles.card, heat === h.id && styles.cardOn, locked && styles.locked]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: heat === h.id, disabled: locked }}
                >
                  <Text style={[styles.cardTitle, heat === h.id && styles.cardTitleOn]}>
                    {h.name}
                  </Text>
                  <Text style={[styles.cardSub, heat === h.id && styles.cardSubOn]}>
                    {h.sample}
                  </Text>
                </Pressable>
              );
            })}
            {!adult && (
              <Pressable onPress={() => setAdult(true)} style={styles.link}>
                <Text style={styles.linkLabel}>I&apos;m 17 or older (unlocks Unhinged)</Text>
              </Pressable>
            )}
            <Primary label="That's my Vinnie" onPress={() => go('budget')} />
          </>
        )}

        {step === 'budget' && (
          <>
            <View style={styles.amountRow}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                keyboardType="decimal-pad"
                style={styles.amount}
                accessibilityLabel="Monthly budget in dollars"
                selectTextOnFocus
              />
            </View>
            <View style={styles.chips}>
              {BUDGETS.map((b) => (
                <Pressable key={b} onPress={() => setBudget(String(b / 100))} style={styles.chip}>
                  <Text style={styles.chipLabel}>
                    {formatMoney(b, 'USD', { trimZeroCents: true })}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Primary label="That's the number" onPress={() => saveBudget()} />
            <Pressable onPress={() => saveBudget(true)} style={styles.link}>
              <Text style={styles.linkLabel}>Skip for now</Text>
            </Pressable>
          </>
        )}

        {step === 'receipt' && !real && (
          <>
            <Primary label="Show me what he's got" onPress={() => finish('example')} />
            <Pressable onPress={() => setReal(true)} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>Log a real one</Text>
            </Pressable>
          </>
        )}

        {step === 'receipt' && real && (
          <>
            <View style={styles.amountRow}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.line}
                style={styles.amount}
                accessibilityLabel="Amount in dollars"
                autoFocus
              />
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What'd you buy?"
              placeholderTextColor={colors.inkSoft}
              style={styles.input}
              maxLength={60}
            />
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.chip, category === c.id && styles.chipOn]}
                >
                  <Text style={[styles.chipLabel, category === c.id && styles.chipLabelOn]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Primary
              label="Give Vinnie the Receipt"
              disabled={!parseDecimalToMinor(amount)}
              onPress={() => finish('real')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Primary(props: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[styles.primary, props.disabled && styles.locked]}
    >
      <Text style={styles.primaryLabel}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: space.xl, gap: space.md, flexGrow: 1, justifyContent: 'center' },
  vinnie: { alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  avatar: {
    backgroundColor: '#3A2E28',
    borderRadius: radius.lg,
    padding: space.md,
    overflow: 'hidden',
  },
  bubble: {
    backgroundColor: '#FFFAF0',
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 4,
    padding: space.md,
  },
  say: { fontSize: 18, fontWeight: '700', color: colors.ink, lineHeight: 25, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  cardOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  cardTitle: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  cardTitleOn: { color: colors.card },
  cardSub: { color: colors.inkSoft, marginTop: 2 },
  cardSubOn: { color: colors.line },
  locked: { opacity: 0.4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dollar: { fontSize: 40, fontWeight: '800', color: colors.inkSoft },
  amount: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 160,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    color: colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { fontWeight: '700', color: colors.ink },
  chipLabelOn: { color: colors.card },
  primary: {
    backgroundColor: colors.mustard,
    borderBottomColor: colors.mustardDark,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    marginTop: space.sm,
  },
  primaryLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
  secondary: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  secondaryLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  link: { alignSelf: 'center', padding: space.sm },
  linkLabel: { color: colors.inkSoft, fontWeight: '700', textDecorationLine: 'underline' },
});
