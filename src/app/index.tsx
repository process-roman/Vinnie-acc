// Office (home). M1: log a receipt, Vinnie reads it and reacts; a meltdown walks
// him to the glass, he punches it, and calls you.

import { ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Entry, monthSpentMinor } from '@/domain/entries';
import { formatMoney } from '@/domain/money';
import { Heat } from '@/domain/reaction/dialogue';
import { NewEntry, Reaction } from '@/domain/reaction/react';
import { Tier } from '@/domain/reaction/tier';
import { Point } from '@/scene/iso';
import { CAMERA_SPOT, OfficeCanvas, OfficeCanvasHandle } from '@/scene/OfficeCanvas';
import { PROPS } from '@/scene/room';
import { useCall } from '@/store/call';
import { useFx } from '@/store/fx';
import { useGame } from '@/store/game';
import { BudgetSheet, HistorySheet } from '@/ui/LedgerSheets';
import { ReceiptSheet } from '@/ui/ReceiptSheet';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { colors, radius, space } from '@/ui/tokens';

const DESK_SPOT = PROPS.find((p) => p.id === 'desk')!.standAt;
const ZOOM = 1.35;
const ZOOM_MS = 1400;

const STATUS: Record<Tier, string> = {
  approve: 'Vinnie approves.',
  neutral: 'Vinnie filed it.',
  judge: 'Vinnie is judging you.',
  angry: 'Vinnie is fuming.',
  meltdown: 'Vinnie needs a minute.',
};

const HEATS: Heat[] = ['gentle', 'classic', 'unhinged'];
const HEAT_LABEL: Record<Heat, string> = {
  gentle: 'Gentle',
  classic: 'Classic',
  unhinged: 'Unhinged',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Bubble = { id: number; text: string; anchor: Point; done: () => void };
type OpenSheet = 'receipt' | 'history' | 'budget' | null;

export default function OfficeScreen() {
  const fx = useFx();
  const ring = useCall((s) => s.ring);
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const heat = useGame((s) => s.heat);
  const game = useGame.getState;

  const office = useRef<OfficeCanvasHandle>(null);
  const sceneBox = useRef<ComponentRef<typeof View>>(null);
  const [scene, setScene] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState('Vinnie is doing your taxes.');
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [busy, setBusy] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // Camera: zoom about a point (the spot Vinnie walks to) so he fills the glass.
  const zoom = useSharedValue(1);
  const zoomX = useSharedValue(0);
  const zoomY = useSharedValue(0);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomX.value }, { translateY: zoomY.value }, { scale: zoom.value }],
  }));
  const zoomTo = (at: Point | null, ms: number) => {
    const s = at ? ZOOM : 1;
    const t = { duration: ms, easing: Easing.inOut(Easing.cubic) };
    zoom.value = withTiming(s, t);
    zoomX.value = withTiming(at ? (scene.width / 2 - at.x) * (s - 1) : 0, t);
    zoomY.value = withTiming(at ? (scene.height / 2 - at.y) * (s - 1) : 0, t);
  };

  const say = (text: string) =>
    new Promise<void>((resolve) => {
      const head = office.current?.headPosition() ?? { x: scene.width / 2, y: scene.height / 2 };
      setBubble({
        id: Date.now(),
        text,
        anchor: { x: head.x, y: head.y - 10 },
        done: () => {
          setBubble(null);
          resolve();
        },
      });
    });

  const sceneOrigin = () =>
    new Promise<Point>((resolve) =>
      sceneBox.current
        ? sceneBox.current.measureInWindow((x, y) => resolve({ x, y }))
        : resolve({ x: 0, y: 0 }),
    );

  const play = async (entry: Entry, reaction: Reaction) => {
    const canvas = office.current;
    if (!canvas) return;
    setBusy(true);
    try {
      setStatus('Vinnie is reading your receipt…');
      await canvas.walkTo(DESK_SPOT);
      await sleep(450);
      await say(reaction.line);

      if (reaction.escalation !== 'none' && reaction.call) {
        setStatus('Vinnie is walking up to the glass…');
        const head = canvas.headPositionAt(CAMERA_SPOT);
        zoomTo(head, ZOOM_MS);
        await canvas.walkTo(CAMERA_SPOT);
        canvas.alert(800);
        await sleep(800);
        if (reaction.escalation === 'punch') {
          const origin = await sceneOrigin();
          // The zoom keeps his head fixed on screen, so this is where the fist lands.
          fx.punch({ x: origin.x + head.x, y: origin.y + head.y });
          setStatus('Vinnie punched the screen.');
        } else {
          fx.knock();
          setStatus('Vinnie knocked on the glass.');
        }
        await sleep(1100);
        setStatus('Vinnie is calling you…');
        await ring(reaction.call, entry);
        zoomTo(null, 700);
        await canvas.walkTo(DESK_SPOT);
      }
      setStatus(STATUS[reaction.tier]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (input: NewEntry) => {
    setSheet(null);
    const { entry, reaction } = game().logEntry(input);
    play(entry, reaction);
  };

  const now = new Date();
  const spent = monthSpentMinor(entries, now);
  const share = limit ? spent / limit : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {/* Prototype: tap the title for playtest controls. */}
        <Pressable onPress={() => setDebugOpen((o) => !o)} accessibilityLabel="Playtest controls">
          <Text style={styles.title}>Vinnie</Text>
          <Text style={styles.subtitle}>
            {now.toLocaleString('en-US', { month: 'long' })} · {HEAT_LABEL[heat]}
          </Text>
        </Pressable>
        <Pressable style={styles.budget} onPress={() => setSheet('budget')}>
          <Text style={styles.budgetLabel}>This month</Text>
          <Text style={[styles.budgetAmount, share > 1 && styles.over]}>
            {formatMoney(spent, 'USD', { trimZeroCents: true })}
          </Text>
          <Text style={styles.subtitle}>
            of {limit === null ? 'no budget' : formatMoney(limit, 'USD', { trimZeroCents: true })}
          </Text>
          <View style={styles.meter}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(100, share * 100)}%`,
                  backgroundColor:
                    share > 1 ? colors.brick : share >= 0.85 ? colors.mustard : colors.good,
                },
              ]}
            />
          </View>
        </Pressable>
      </View>

      <View
        ref={sceneBox}
        style={styles.scene}
        onLayout={({ nativeEvent: { layout } }) =>
          setScene({ width: layout.width, height: layout.height })
        }
      >
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          {scene.width > 0 && (
            <OfficeCanvas
              ref={office}
              width={scene.width}
              height={scene.height}
              onEvent={setStatus}
              disabled={busy}
            />
          )}
          {bubble && (
            <SpeechBubble
              key={bubble.id}
              text={bubble.text}
              anchor={bubble.anchor}
              parentWidth={scene.width}
              parentHeight={scene.height}
              onDone={bubble.done}
            />
          )}
        </Animated.View>
      </View>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {status}
      </Text>

      {debugOpen && (
        <View style={styles.debug}>
          <Chip
            label={`Heat: ${HEAT_LABEL[heat]}`}
            onPress={() => game().setHeat(HEATS[(HEATS.indexOf(heat) + 1) % HEATS.length])}
          />
          <Chip label="Nearly broke" onPress={() => game().loadNearlyBrokeDemo()} />
          <Chip label={`Repair (${fx.crackLevel})`} onPress={fx.repair} />
          <Chip label="Reset" onPress={() => game().reset()} />
        </View>
      )}

      <View style={styles.bottomBar}>
        <Pressable style={styles.barItem} onPress={() => setSheet('history')} disabled={busy}>
          <Text style={styles.barLabel}>History</Text>
        </Pressable>
        <Pressable
          style={[styles.mainButton, busy && styles.mainButtonBusy]}
          onPress={() => setSheet('receipt')}
          disabled={busy}
        >
          <Text style={styles.mainButtonLabel}>
            {busy ? 'Vinnie is reading…' : '+ New Receipt'}
          </Text>
        </Pressable>
        <Pressable style={styles.barItem} onPress={() => setSheet('budget')} disabled={busy}>
          <Text style={styles.barLabel}>Budget</Text>
        </Pressable>
      </View>

      <ReceiptSheet
        visible={sheet === 'receipt'}
        onClose={() => setSheet(null)}
        onSubmit={submit}
      />
      <HistorySheet visible={sheet === 'history'} onClose={() => setSheet(null)} />
      <BudgetSheet visible={sheet === 'budget'} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.brick },
  subtitle: { fontSize: 12, color: colors.inkSoft },
  budget: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    alignItems: 'flex-end',
    minWidth: 140,
  },
  budgetLabel: { fontSize: 11, color: colors.inkSoft },
  budgetAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  over: { color: colors.brick },
  meter: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginTop: 6,
    overflow: 'hidden',
  },
  meterFill: { height: 6, borderRadius: 3 },
  scene: { flex: 1, overflow: 'hidden' },
  status: { textAlign: 'center', color: colors.inkSoft, marginVertical: space.sm },
  debug: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
  },
  chipLabel: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  barItem: { padding: space.md },
  barLabel: { color: colors.ink, fontWeight: '600' },
  mainButton: {
    backgroundColor: colors.mustard,
    borderBottomColor: colors.mustardDark,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  mainButtonBusy: { opacity: 0.6 },
  mainButtonLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
