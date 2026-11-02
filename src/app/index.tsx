// Office (home). Log a receipt, Vinnie reads it and reacts; a meltdown walks him
// to the glass, he punches it, and calls you.

import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategory } from '@/domain/categories';
import { Entry, monthSpentMinor } from '@/domain/entries';
import { formatMoney } from '@/domain/money';
import { pickPropLine, PropTarget } from '@/domain/propLines';
import { QuickChip, quickChips } from '@/domain/quickChips';
import { Heat } from '@/domain/reaction/dialogue';
import { Reaction } from '@/domain/reaction/react';
import { Tier } from '@/domain/reaction/tier';
import { roomState } from '@/domain/roomState';
import { Point } from '@/scene/iso';
import { CAMERA_SPOT, OfficeCanvas, OfficeCanvasHandle, TapTarget } from '@/scene/OfficeCanvas';
import { Waypoint, WAYPOINTS } from '@/scene/room';
import { AnimName, ANIM_NAMES } from '@/scene/sprites/vinnie';
import { useCall } from '@/store/call';
import { useFx } from '@/store/fx';
import { LogInput, StoredEntry, useGame } from '@/store/game';
import { BudgetSheet, HistorySheet } from '@/ui/LedgerSheets';
import { ReceiptSheet, ReceiptValues } from '@/ui/ReceiptSheet';
import { SpeechBubble } from '@/ui/SpeechBubble';
import { colors, radius, space } from '@/ui/tokens';

const DESK_SPOT = WAYPOINTS.desk;
const ZOOM = 1.35;
const ZOOM_MS = 1400;
const USER_ZOOMS = [1, 1.3, 1.6];

/** What the status line says while Vinnie is in each animation. */
const ANIM_STATUS: Record<AnimName, string> = {
  idle: 'Vinnie is doing your taxes.',
  walk: 'Vinnie paces.',
  sit: 'Vinnie is crunching numbers.',
  inspect: 'Vinnie is reading your receipt…',
  celebrate: 'Vinnie is celebrating.',
  shout: 'Vinnie is yelling.',
  slam: 'Vinnie slammed the desk.',
  phone: 'Vinnie is on the phone.',
  punch: 'Vinnie punched the screen.',
  repair: 'Vinnie is fixing the glass.',
};

/** Things he does on his own when nobody's logging anything. */
const IDLE_ACTIVITIES: { to: Waypoint; anim: AnimName; status: string }[] = [
  { to: 'chair', anim: 'sit', status: 'Vinnie is crunching numbers.' },
  { to: 'espresso', anim: 'idle', status: 'Vinnie is eyeing the espresso machine.' },
  { to: 'window', anim: 'idle', status: 'Vinnie looks out the window.' },
  { to: 'plant', anim: 'inspect', status: 'Vinnie checks on the plant.' },
  { to: 'centre', anim: 'idle', status: 'Vinnie paces.' },
];
const IDLE_MIN_MS = 7000;
const IDLE_MAX_MS = 13000;

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

const UNDO_MS = 5000;

type Bubble = { id: number; text: string; anchor: Point; done: () => void };
type OpenSheet =
  | { kind: 'new'; key: number; initial: Partial<ReceiptValues> & { category: string } }
  | { kind: 'edit'; entry: StoredEntry }
  | { kind: 'history' }
  | { kind: 'budget' }
  | null;
type Undo = { id: string; label: string };

export default function OfficeScreen() {
  const ready = useGame((s) => s.ready);
  // Paper until the database has loaded (a few milliseconds).
  return ready ? <Office /> : <View style={styles.loading} />;
}

function Office() {
  const fx = useFx();
  const ring = useCall((s) => s.ring);
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const heat = useGame((s) => s.heat);
  const lastCategory = useGame((s) => s.lastCategory);
  const prefill = useGame((s) => s.prefill);
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

  /** Animation while he says his line, by how he feels about the receipt. */
  const TIER_ANIM: Record<Tier, AnimName> = {
    approve: 'celebrate',
    neutral: 'idle',
    judge: 'inspect',
    angry: 'shout',
    meltdown: 'shout',
  };

  const play = async (entry: Entry, reaction: Reaction) => {
    const canvas = office.current;
    if (!canvas) return;
    setBusy(true);
    setUserZoom(0);
    try {
      setStatus('Vinnie is reading your receipt…');
      await canvas.walkTo(DESK_SPOT);
      canvas.play('inspect');
      await sleep(900);
      canvas.play(TIER_ANIM[reaction.tier]);
      await say(reaction.line);
      if (reaction.tier === 'angry') {
        canvas.play('slam');
        await sleep(320);
        fx.knock();
        await sleep(500);
      }

      if (reaction.escalation !== 'none' && reaction.call) {
        setStatus('Vinnie is walking up to the glass…');
        const head = canvas.headPositionAt(CAMERA_SPOT);
        zoomTo(head, ZOOM_MS);
        await canvas.walkTo(CAMERA_SPOT);
        canvas.alert(800);
        await sleep(800);
        if (reaction.escalation === 'punch') {
          canvas.play('punch');
          // The fist lands on the third frame of the punch.
          await sleep(260);
          const origin = await sceneOrigin();
          // The zoom keeps his head fixed on screen, so this is where the fist lands.
          fx.punch({ x: origin.x + head.x, y: origin.y + head.y });
          setStatus('Vinnie punched the screen.');
        } else {
          canvas.play('slam');
          await sleep(300);
          fx.knock();
          setStatus('Vinnie knocked on the glass.');
        }
        await sleep(1100);
        canvas.play('phone');
        setStatus('Vinnie is calling you…');
        await ring(reaction.call, entry);
        zoomTo(null, 700);
        await canvas.walkTo(DESK_SPOT);
      }
      canvas.play('idle');
      setStatus(STATUS[reaction.tier]);
    } finally {
      setBusy(false);
    }
  };

  /** Repair moment (blueprint 4.4): he tapes up the glass himself. */
  const repairGlass = async () => {
    const canvas = office.current;
    if (!canvas || busy || fx.crackLevel === 0) return;
    setBusy(true);
    setUserZoom(0);
    try {
      setStatus('Vinnie is walking up to the glass…');
      zoomTo(canvas.headPositionAt(CAMERA_SPOT), ZOOM_MS);
      await canvas.walkTo(CAMERA_SPOT);
      canvas.play('repair');
      setStatus(ANIM_STATUS.repair);
      await sleep(1800);
      fx.repair();
      canvas.play('idle');
      await say("There. Don't tell anyone I did this.");
      zoomTo(null, 700);
      await canvas.walkTo(DESK_SPOT);
      setStatus(ANIM_STATUS.idle);
    } finally {
      setBusy(false);
    }
  };

  // Taps in the office: props get a line from Vinnie, the floor gets a walk.
  const lastLines = useRef<Partial<Record<PropTarget, string>>>({});
  const onSceneTap = async (t: TapTarget) => {
    const canvas = office.current;
    if (!canvas || busy || bubble) return;
    if (t.kind === 'floor') {
      setStatus(ANIM_STATUS.walk);
      await canvas.walkTo(t.at);
      return;
    }
    const target: PropTarget = t.kind === 'vinnie' ? 'vinnie' : t.target;
    const line = pickPropLine(target, room, lastLines.current[target], Math.random);
    lastLines.current[target] = line;
    if (target === 'cat') {
      // The cat speaks for itself.
      setStatus(line);
      return;
    }
    if (target === 'vinnie') canvas.alert(700);
    await say(line);
  };

  // When nothing's happening, Vinnie potters around his office.
  useEffect(() => {
    // Paused while playtest controls are open, so poses can be checked.
    if (busy || bubble || sheet || debugOpen) return;
    const id = setTimeout(
      async () => {
        const canvas = office.current;
        if (!canvas) return;
        const pick = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)];
        setStatus(ANIM_STATUS.walk);
        await canvas.walkTo(WAYPOINTS[pick.to]);
        canvas.play(pick.anim);
        setStatus(pick.status);
      },
      IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS),
    );
    return () => clearTimeout(id);
  }, [busy, bubble, sheet, status, debugOpen]);

  // Zoom buttons scale the whole scene about its centre.
  const [userZoom, setUserZoom] = useState(0);
  const userScale = useSharedValue(1);
  useEffect(() => {
    userScale.value = withTiming(USER_ZOOMS[userZoom], { duration: 250 });
  }, [userZoom, userScale]);
  const userZoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: userScale.value }] }));

  const closeSheet = () => {
    setSheet(null);
    if (game().prefill) game().setPrefill(null);
  };

  const log = (input: LogInput) => {
    closeSheet();
    const { entry, reaction } = game().logEntry(input);
    play(entry, reaction);
    return entry;
  };

  const openNew = (initial: Partial<ReceiptValues> = {}) =>
    setSheet({ kind: 'new', key: Date.now(), initial: { category: lastCategory, ...initial } });

  // A quick-add link (vinnie://add?...) shows a pre-filled receipt once Vinnie is free.
  const shown: OpenSheet =
    sheet ??
    (prefill && !busy
      ? {
          kind: 'new',
          key: -1,
          initial: {
            category: prefill.category ?? lastCategory,
            amountMinor: prefill.amountMinor,
            description: prefill.merchant,
          },
        }
      : null);

  // One tap logs a frequent purchase; Undo removes it for a few seconds.
  const [undo, setUndo] = useState<Undo | null>(null);
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [undo]);
  const logChip = (chip: QuickChip) => {
    const entry = log({
      type: 'expense',
      amountMinor: chip.amountMinor,
      category: chip.category,
      description: chip.description,
    });
    setUndo({ id: entry.id, label: `${chipLabel(chip)} ${formatMoney(chip.amountMinor)}` });
  };

  const now = new Date();
  const chips = quickChips(entries, now);
  // Recomputed every minute too, so the cat comes out once Vinnie has calmed down.
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinute((m) => m + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const room = useMemo(
    () => roomState(entries, limit, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` only forces a refresh
    [entries, limit, minute],
  );
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
        <Pressable style={styles.budget} onPress={() => setSheet({ kind: 'budget' })}>
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
        <Animated.View style={[StyleSheet.absoluteFill, userZoomStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            {scene.width > 0 && (
              <OfficeCanvas
                ref={office}
                width={scene.width}
                height={scene.height}
                room={room}
                onTap={onSceneTap}
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
        </Animated.View>
        <View style={styles.zoomButtons}>
          <ZoomButton
            label="+"
            disabled={busy || userZoom === USER_ZOOMS.length - 1}
            onPress={() => setUserZoom((z) => Math.min(USER_ZOOMS.length - 1, z + 1))}
          />
          <ZoomButton
            label="−"
            disabled={busy || userZoom === 0}
            onPress={() => setUserZoom((z) => Math.max(0, z - 1))}
          />
        </View>
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
          <Chip label={`Repair (${fx.crackLevel})`} onPress={repairGlass} />
          <Chip label="Reset" onPress={() => game().reset()} />
          {spent > 0 &&
            [0.5, 0.7, 0.9, 1.1].map((s) => (
              <Chip
                key={s}
                label={`${Math.round(s * 100)}%`}
                onPress={() => game().setLimit(Math.round(spent / s))}
              />
            ))}
          {ANIM_NAMES.map((a) => (
            <Chip
              key={a}
              label={a}
              onPress={() => {
                office.current?.play(a);
                setStatus(ANIM_STATUS[a]);
              }}
            />
          ))}
        </View>
      )}

      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          contentContainerStyle={styles.quickRowContent}
        >
          {chips.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => logChip(c)}
              disabled={busy}
              style={({ pressed }) => [
                styles.quick,
                pressed && styles.quickPressed,
                busy && styles.dim,
              ]}
              accessibilityLabel={`Log ${chipLabel(c)} for ${formatMoney(c.amountMinor)}`}
            >
              <View style={[styles.dot, { backgroundColor: getCategory(c.category).color }]} />
              <Text style={styles.quickLabel}>{chipLabel(c)}</Text>
              <Text style={styles.quickAmount}>
                {formatMoney(c.amountMinor, 'USD', { trimZeroCents: true })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        <Pressable
          style={styles.barItem}
          onPress={() => setSheet({ kind: 'history' })}
          disabled={busy}
        >
          <Text style={styles.barLabel}>History</Text>
        </Pressable>
        <Pressable
          style={[styles.mainButton, busy && styles.dim]}
          onPress={() => openNew()}
          disabled={busy}
        >
          <Text style={styles.mainButtonLabel}>
            {busy ? 'Vinnie is reading…' : '+ New Receipt'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.barItem}
          onPress={() => setSheet({ kind: 'budget' })}
          disabled={busy}
        >
          <Text style={styles.barLabel}>Budget</Text>
        </Pressable>
      </View>

      {undo && (
        <View style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={1}>
            Logged {undo.label}
          </Text>
          <Pressable
            onPress={() => {
              game().deleteEntry(undo.id);
              setUndo(null);
            }}
            style={styles.toastAction}
          >
            <Text style={styles.toastActionLabel}>Undo</Text>
          </Pressable>
        </View>
      )}

      {shown?.kind === 'new' && (
        <ReceiptSheet
          key={shown.key}
          visible
          mode="new"
          initial={shown.initial}
          onClose={closeSheet}
          onSubmit={log}
        />
      )}
      {shown?.kind === 'edit' && (
        <ReceiptSheet
          key={shown.entry.id}
          visible
          mode="edit"
          initial={shown.entry}
          onClose={() => setSheet({ kind: 'history' })}
          onSubmit={(v) => {
            game().editEntry(shown.entry.id, v);
            setSheet({ kind: 'history' });
          }}
          onDelete={() => {
            game().deleteEntry(shown.entry.id);
            setSheet({ kind: 'history' });
          }}
        />
      )}
      <HistorySheet
        visible={shown?.kind === 'history'}
        onClose={() => setSheet(null)}
        onEdit={(entry) => setSheet({ kind: 'edit', entry })}
      />
      <BudgetSheet visible={shown?.kind === 'budget'} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

const chipLabel = (c: QuickChip) => c.description || getCategory(c.category).label;

function ZoomButton(props: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[styles.zoomButton, props.disabled && styles.dim]}
      accessibilityLabel={props.label === '+' ? 'Zoom in' : 'Zoom out'}
    >
      <Text style={styles.zoomLabel}>{props.label}</Text>
    </Pressable>
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
  loading: { flex: 1, backgroundColor: colors.paper },
  zoomButtons: { position: 'absolute', right: 0, bottom: space.sm, gap: space.sm },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: { fontSize: 20, fontWeight: '800', color: colors.ink },
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.lg },
  quickRow: { flexGrow: 0, marginHorizontal: -space.lg },
  quickRowContent: { paddingHorizontal: space.lg, gap: space.sm },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  quickPressed: { backgroundColor: colors.line },
  quickLabel: { color: colors.ink, fontWeight: '700' },
  quickAmount: { color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dim: { opacity: 0.5 },
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: 140,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
  },
  toastText: { flex: 1, color: colors.card, fontWeight: '600' },
  toastAction: { paddingVertical: space.sm, paddingHorizontal: space.md },
  toastActionLabel: { color: colors.mustard, fontWeight: '800' },
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
  mainButtonLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
