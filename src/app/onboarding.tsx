// Onboarding (blueprint §10, 8.1), played as the opening scene of a 90s adventure game:
// Vinnie's talking head and a dialogue box. He introduces himself, asks your name, the budget
// and how loud he should be, then takes a first receipt. The scripted first meltdown, repair
// preview, shop intro and the notification ask then play out in the office.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import onboarding from '@/content/onboarding.json';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { formatMoney, parseDecimalToMinor } from '@/domain/money';
import { fillPlaceholders, Heat } from '@/domain/reaction/dialogue';
import { DuskBackdrop } from '@/scene/DuskBackdrop';
import { VinniePortrait } from '@/scene/VinniePortrait';
import { track } from '@/services/analytics';
import { useLoopingSound } from '@/services/sound';
import { useGame } from '@/store/game';
import { space } from '@/ui/tokens';

type Step = 'intro' | 'name' | 'budget' | 'heat' | 'receipt';

const HEATS: { id: Heat; name: string; sample: string }[] = [
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
const CHAR_MS = 28;
const MONO = Platform.select({ ios: 'Courier', default: 'monospace' });

const NAVY = '#10194a';
const NIGHT = '#080c24';
const CREAM = '#f6ead0';
const GOLD = '#e8c547';
const GREY = '#c6c2b8';

export default function Onboarding() {
  const game = useGame.getState;
  const heat = useGame((s) => s.heat);
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<Step>('intro');
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('2000');
  const [adult, setAdult] = useState(false);
  const [real, setReal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('coffee');
  const [description, setDescription] = useState('');
  // Which line has finished typing. He talks until the line on screen is the finished one.
  const [typedLine, setTypedLine] = useState<string | null>(null);

  const go = (next: Step) => {
    track('onboarding_step', { step: next });
    setStep(next);
  };

  const line =
    step === 'intro'
      ? onboarding.intro[page]
      : fillPlaceholders(onboarding[step], { name: name.trim() });
  const typed = typedLine === line;

  const pickHeat = (h: Heat) => {
    if (h === 'unhinged' && !adult) return;
    game().setHeat(h);
  };

  const saveName = () => {
    game().setUserName(name.trim());
    go('budget');
  };

  const saveBudget = (skip = false) => {
    const minor = skip ? null : parseDecimalToMinor(budget);
    if (minor) game().setLimit(minor);
    go('heat');
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

  // Steps with a keyboard get a smaller head, so the field stays on screen.
  const compact = step === 'name' || step === 'budget' || (step === 'receipt' && real);
  const portrait = Math.min(width - space.xl * 2, compact ? height * 0.2 : height * 0.36, 280);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <DuskBackdrop />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.portraitFrame}>
          <VinniePortrait size={portrait} talking={!typed} />
        </View>
        <Text style={styles.nameplate}>VINNIE LEDGER, C.P.A.</Text>

        <Dialogue key={line} text={line} onTyped={() => setTypedLine(line)} />

        {typed && step === 'intro' && (
          <Retro
            label={page + 1 < onboarding.intro.length ? 'Go on...' : 'Alright, Vinnie'}
            onPress={() => (page + 1 < onboarding.intro.length ? setPage(page + 1) : go('name'))}
          />
        )}

        {typed && step === 'name' && (
          <>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.field}
              placeholder="YOUR NAME"
              placeholderTextColor="#6d6a85"
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && saveName()}
              accessibilityLabel="Your name"
            />
            <Retro label="That's me" disabled={!name.trim()} onPress={saveName} />
          </>
        )}

        {typed && step === 'budget' && (
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
                <Retro
                  key={b}
                  small
                  label={formatMoney(b, 'USD', { trimZeroCents: true })}
                  onPress={() => setBudget(String(b / 100))}
                />
              ))}
            </View>
            <Retro label="That's the number" onPress={() => saveBudget()} />
            <Pressable onPress={() => saveBudget(true)} style={styles.link}>
              <Text style={styles.linkLabel}>Skip for now</Text>
            </Pressable>
          </>
        )}

        {typed && step === 'heat' && (
          <>
            {HEATS.map((h) => {
              const locked = h.id === 'unhinged' && !adult;
              const on = heat === h.id;
              return (
                <Pressable
                  key={h.id}
                  onPress={() => pickHeat(h.id)}
                  style={[styles.card, on && styles.cardOn, locked && styles.locked]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: locked }}
                >
                  <Text style={[styles.cardTitle, on && styles.cardTextOn]}>
                    {on ? '> ' : '  '}
                    {h.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.cardSub, on && styles.cardTextOn]}>{h.sample}</Text>
                </Pressable>
              );
            })}
            {!adult && (
              <Pressable onPress={() => setAdult(true)} style={styles.link}>
                <Text style={styles.linkLabel}>I&apos;m 17 or older (unlocks Unhinged)</Text>
              </Pressable>
            )}
            <Retro label="That's my Vinnie" onPress={() => go('receipt')} />
          </>
        )}

        {typed && step === 'receipt' && !real && (
          <>
            <Retro label="Show me what he's got" onPress={() => finish('example')} />
            <Retro label="Log a real one" quiet onPress={() => setReal(true)} />
          </>
        )}

        {typed && step === 'receipt' && real && (
          <>
            <View style={styles.amountRow}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#6d6a85"
                style={styles.amount}
                accessibilityLabel="Amount in dollars"
                autoFocus
              />
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="WHAT'D YOU BUY?"
              placeholderTextColor="#6d6a85"
              style={styles.field}
              maxLength={60}
            />
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Retro
                  key={c.id}
                  small
                  on={category === c.id}
                  label={c.label}
                  onPress={() => setCategory(c.id)}
                />
              ))}
            </View>
            <Retro
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

/** The dialogue box: text types out while he talks. A tap finishes the line. */
function Dialogue({ text, onTyped }: { text: string; onTyped: () => void }) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;
  useLoopingSound('talk', !done);
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setShown((n) => n + 1), CHAR_MS);
    return () => clearInterval(id);
  }, [done]);
  useEffect(() => {
    if (done) onTyped();
    // Only when it finishes: the parent's callback changes with every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  return (
    <Pressable
      onPress={() => setShown(text.length)}
      style={styles.dialogue}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Vinnie says: ${text}`}
    >
      <View style={styles.dialogueInner}>
        {/* Full text keeps the box's size stable; the typed part is drawn over it. */}
        <Text style={[styles.say, styles.ghost]}>{text}</Text>
        <Text style={[styles.say, styles.typed]}>{text.slice(0, shown)}</Text>
      </View>
    </Pressable>
  );
}

/** A chunky bevelled button, lit from the top left. */
function Retro(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  quiet?: boolean;
  on?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.retro,
        props.small && styles.retroSmall,
        props.quiet && styles.retroQuiet,
        props.on && styles.retroOn,
        pressed && styles.retroPressed,
        props.disabled && styles.locked,
      ]}
    >
      <Text style={[styles.retroLabel, props.small && styles.retroLabelSmall]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The backdrop paints the screen; this only shows before it's drawn.
  screen: { flex: 1, backgroundColor: NIGHT },
  body: { padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: 'center' },
  portraitFrame: {
    alignSelf: 'center',
    borderWidth: 4,
    borderTopColor: GOLD,
    borderLeftColor: GOLD,
    borderBottomColor: '#8f6f24',
    borderRightColor: '#8f6f24',
    backgroundColor: '#000',
  },
  nameplate: {
    alignSelf: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    backgroundColor: 'rgba(16, 12, 36, 0.75)',
    color: GOLD,
    fontFamily: MONO,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  dialogue: { borderWidth: 3, borderColor: CREAM, backgroundColor: NAVY, padding: 3 },
  dialogueInner: {
    borderWidth: 1,
    borderColor: '#5a66a8',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  say: { fontFamily: MONO, fontWeight: '700', fontSize: 16, lineHeight: 22, color: CREAM },
  ghost: { opacity: 0 },
  typed: { position: 'absolute', left: space.md, right: space.md, top: space.sm },
  retro: {
    backgroundColor: GREY,
    borderWidth: 3,
    borderTopColor: '#f4f1e8',
    borderLeftColor: '#f4f1e8',
    borderBottomColor: '#6b675d',
    borderRightColor: '#6b675d',
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    alignItems: 'center',
  },
  retroSmall: { paddingVertical: 4, paddingHorizontal: space.sm },
  retroQuiet: { backgroundColor: '#8f8b80' },
  retroOn: { backgroundColor: GOLD },
  retroPressed: {
    borderTopColor: '#6b675d',
    borderLeftColor: '#6b675d',
    borderBottomColor: '#f4f1e8',
    borderRightColor: '#f4f1e8',
  },
  retroLabel: { fontFamily: MONO, fontWeight: '700', fontSize: 16, color: '#14110c' },
  retroLabelSmall: { fontSize: 13 },
  locked: { opacity: 0.45 },
  field: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: GREY,
    color: GOLD,
    fontFamily: MONO,
    fontWeight: '700',
    fontSize: 18,
    padding: space.sm + 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    backgroundColor: NAVY,
    borderWidth: 3,
    borderColor: CREAM,
  },
  dollar: { fontFamily: MONO, fontSize: 34, fontWeight: '700', color: GOLD },
  amount: {
    fontFamily: MONO,
    fontSize: 36,
    fontWeight: '700',
    color: CREAM,
    minWidth: 160,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  card: { borderWidth: 2, borderColor: '#5a66a8', backgroundColor: NAVY, padding: space.sm + 2 },
  cardOn: { borderColor: GOLD },
  cardTitle: { fontFamily: MONO, fontWeight: '700', fontSize: 16, color: CREAM },
  cardSub: { fontFamily: MONO, fontSize: 13, lineHeight: 18, color: '#b9bedb', marginTop: 2 },
  cardTextOn: { color: GOLD },
  link: {
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: 'rgba(16, 12, 36, 0.75)',
  },
  linkLabel: { fontFamily: MONO, color: CREAM, textDecorationLine: 'underline' },
});
