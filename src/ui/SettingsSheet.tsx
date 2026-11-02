// Settings (blueprint Screen 7), M6 part: heat level, notifications, and the
// iPhone quick-add guide (7.4). Export and delete-all come in M7.

import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Heat } from '@/domain/reaction/dialogue';
import { useGame } from '@/store/game';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

const HEATS: { id: Heat; name: string; sample: string }[] = [
  { id: 'gentle', name: 'Gentle', sample: '"Let\'s slow down a little, alright?"' },
  { id: 'classic', name: 'Classic', sample: '"We had a NUMBER. We had an AGREEMENT."' },
  { id: 'unhinged', name: 'Unhinged', sample: 'Classic, plus the words his mother hates. 17+.' },
];

const QUICK_ADD_URL = 'vinnie://add?amount=AMOUNT&merchant=MERCHANT';

const SHORTCUT_STEPS = [
  'Open the Shortcuts app and go to the Automation tab.',
  'Tap New Automation, then choose Wallet ("When I tap any of my cards").',
  'Pick your cards and set it to Run Immediately.',
  'Add the action "Open URLs" and paste the link below.',
  "Replace AMOUNT with the Shortcut Input's Amount and MERCHANT with its Merchant (tap each word, then pick the variable).",
  'Pay with Apple Pay. Vinnie opens with the receipt already filled in.',
];

type Props = { visible: boolean; onClose: () => void };

export function SettingsSheet({ visible, onClose }: Props) {
  const heat = useGame((s) => s.heat);
  const setHeat = useGame((s) => s.setHeat);
  const notifications = useGame((s) => s.notificationsEnabled);
  const quietStart = useGame((s) => s.quietStart);
  const quietEnd = useGame((s) => s.quietEnd);
  const setNotifications = useGame((s) => s.setNotificationsEnabled);
  const [denied, setDenied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const toggleNotifications = async (on: boolean) => {
    const result = await setNotifications(on);
    setDenied(on && !result);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>How loud is Vinnie?</Text>
        {HEATS.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => setHeat(h.id)}
            style={[styles.heat, heat === h.id && styles.heatOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: heat === h.id }}
          >
            <Text style={[styles.heatName, heat === h.id && styles.heatNameOn]}>{h.name}</Text>
            <Text style={[styles.heatSample, heat === h.id && styles.heatSampleOn]}>
              {h.sample}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.section}>Notifications</Text>
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>Let Vinnie reach out</Text>
            <Text style={styles.rowSub}>
              At most one a day, never between {quietStart}:00 and {quietEnd}:00. A weekly sit-down,
              the odd call, and a nudge if you go quiet.
            </Text>
          </View>
          <Switch value={notifications} onValueChange={toggleNotifications} />
        </View>
        {denied && (
          <Text style={styles.warn}>
            {Platform.OS === 'web'
              ? 'Notifications work in the phone app.'
              : 'Notifications are off for Vinnie in your phone settings.'}
          </Text>
        )}

        <Text style={styles.section}>Log straight from Apple Pay</Text>
        <Pressable onPress={() => setGuideOpen((o) => !o)} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>iPhone Shortcut setup</Text>
            <Text style={styles.rowSub}>
              Tap your card, and Vinnie opens with the amount and store filled in. iOS 17 or later.
            </Text>
          </View>
          <Text style={styles.chevron}>{guideOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {guideOpen && (
          <View style={styles.guide}>
            {SHORTCUT_STEPS.map((step, i) => (
              <Text key={step} style={styles.step}>
                {i + 1}. {step}
              </Text>
            ))}
            <Text style={styles.code} selectable>
              {QUICK_ADD_URL}
            </Text>
            <Text style={styles.rowSub}>
              You can add &category=coffee (or groceries, dining, etc.) to skip picking one. Vinnie
              also learns which category you use for each store.
            </Text>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 560 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  section: { fontWeight: '800', color: colors.ink, marginTop: space.lg, marginBottom: space.sm },
  heat: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  heatOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  heatName: { fontWeight: '800', color: colors.ink },
  heatNameOn: { color: colors.card },
  heatSample: { color: colors.inkSoft, marginTop: 2 },
  heatSampleOn: { color: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '700', color: colors.ink },
  rowSub: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  warn: { color: colors.brick, fontWeight: '600' },
  chevron: { fontSize: 18, color: colors.inkSoft },
  guide: { backgroundColor: colors.paper, borderRadius: radius.md, padding: space.md, gap: 6 },
  step: { color: colors.ink },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: space.sm,
    color: colors.ink,
  },
});
