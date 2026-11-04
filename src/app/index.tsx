// Office (home). Log a receipt, Vinnie reads it and reacts; a meltdown walks him
// to the glass, he punches it, and calls you.

import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import callbacks from '@/content/callbacks.json';
import calls from '@/content/calls.json';
import onboarding from '@/content/onboarding.json';
import { getCategory } from '@/domain/categories';
import { balance } from '@/domain/coins';
import { Entry, monthSpentMinor, toDateKey } from '@/domain/entries';
import { formatMoney } from '@/domain/money';
import {
  FED_UP_TAPS,
  nextTapStreak,
  NO_TAPS,
  pickCatLine,
  pickFedUpLine,
  pickPropLine,
  PropTarget,
} from '@/domain/propLines';
import { QuickChip, quickChips } from '@/domain/quickChips';
import { MOOD_LABEL, moodState } from '@/domain/mood';
import { fillPlaceholders, Heat } from '@/domain/reaction/dialogue';
import { Reaction } from '@/domain/reaction/react';
import { Tier } from '@/domain/reaction/tier';
import { roomState } from '@/domain/roomState';
import { equippedBySlot } from '@/domain/shop';
import { Point } from '@/scene/iso';
import { CAMERA_SPOT, OfficeCanvas, OfficeCanvasHandle, TapTarget } from '@/scene/OfficeCanvas';
import { Waypoint, WAYPOINTS } from '@/scene/room';
import { AnimName, ANIM_NAMES } from '@/scene/sprites/vinnie';
import { useCall } from '@/store/call';
import { useFx } from '@/store/fx';
import { LogInput, StoredEntry, useGame } from '@/store/game';
import { BudgetSheet, HistorySheet } from '@/ui/LedgerSheets';
import { ReceiptSheet, ReceiptValues } from '@/ui/ReceiptSheet';
import { SettingsSheet } from '@/ui/SettingsSheet';
import { ShareSheet } from '@/ui/ShareSheet';
import { ShopSheet } from '@/ui/ShopSheet';
import { SitdownSheet } from '@/ui/SitdownSheet';
import { ShareMoment } from '@/domain/shareCard';
import { track } from '@/services/analytics';
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
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const UNDO_MS = 5000;
const SHARE_PROMPT_MS = 10000;

// Outside the component: reading the clock is only allowed in an event, not a render.
const tapped = (s: typeof NO_TAPS) => nextTapStreak(s, Date.now());

type Bubble = { id: number; text: string; anchor: Point; speaker?: string; done: () => void };
type OpenSheet =
  | { kind: 'new'; key: number; initial: Partial<ReceiptValues> & { category: string } }
  | { kind: 'edit'; entry: StoredEntry }
  | { kind: 'history' }
  | { kind: 'budget' }
  | { kind: 'shop' }
  | { kind: 'settings' }
  | { kind: 'sitdown' }
  | null;
type Undo = { id: string; label: string };

export default function OfficeScreen() {
  const ready = useGame((s) => s.ready);
  // Paper until the database has loaded (a few milliseconds).
  const onboarded = useGame((s) => s.onboardingDone);
  if (!ready) return <View style={styles.loading} />;
  // First launch (or after Delete everything): meet Vinnie first.
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Office />;
}

function Office() {
  const fx = useFx();
  const ring = useCall((s) => s.ring);
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const heat = useGame((s) => s.heat);
  const lastCategory = useGame((s) => s.lastCategory);
  const prefill = useGame((s) => s.prefill);
  const mood = useGame((s) => s.character.mood);
  const crackLevel = useGame((s) => s.character.crackLevel);
  const coins = useGame((s) => balance(s.coinTx));
  const pendingSitdown = useGame((s) => s.pendingSitdown);
  const pendingCheckIn = useGame((s) => s.pendingCheckIn);
  const onboardingScript = useGame((s) => s.onboardingScript);
  const [notifyAsk, setNotifyAsk] = useState(false);
  const sitdownReady = useGame((s) => s.sitdownAvailable());
  const inventory = useGame((s) => s.inventory);
  const cosmetics = useMemo(() => equippedBySlot(inventory), [inventory]);
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
  // Reduce Motion: no camera zoom toward the glass.
  const reducedMotion = useReducedMotion();
  const zoom = useSharedValue(1);
  const zoomX = useSharedValue(0);
  const zoomY = useSharedValue(0);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomX.value }, { translateY: zoomY.value }, { scale: zoom.value }],
  }));
  const zoomTo = (at: Point | null, ms: number) => {
    const s = at && !reducedMotion ? ZOOM : 1;
    const t = { duration: ms, easing: Easing.inOut(Easing.cubic) };
    zoom.set(withTiming(s, t));
    zoomX.set(withTiming(at ? (scene.width / 2 - at.x) * (s - 1) : 0, t));
    zoomY.set(withTiming(at ? (scene.height / 2 - at.y) * (s - 1) : 0, t));
  };

  const say = (text: string, from?: { at: Point; speaker: string }) =>
    new Promise<void>((resolve) => {
      const head = from?.at ??
        office.current?.headPosition() ?? { x: scene.width / 2, y: scene.height / 2 };
      setBubble({
        id: Date.now(),
        text,
        anchor: { x: head.x, y: head.y - 10 },
        speaker: from?.speaker,
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

      // Cooldowns decide separately whether he breaks the glass and whether he calls.
      if (reaction.escalation !== 'none') {
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
      }
      if (reaction.call) {
        canvas.play('phone');
        setStatus('Vinnie is calling you…');
        game().callPlaced();
        await ring(reaction.call, entry);
      }
      if (reaction.escalation !== 'none') {
        zoomTo(null, 700);
        await canvas.walkTo(DESK_SPOT);
      }
      canvas.play('idle');
      setStatus(STATUS[reaction.tier]);
      // A moment worth sharing (blueprint §12): offer it, never post it.
      if (reaction.escalation !== 'none' || reaction.call) {
        offerShare({
          kind: reaction.escalation === 'punch' ? 'crack' : 'call',
          line: reaction.line,
          amountMinor: entry.amountMinor,
          description: entry.description,
          category: entry.category,
        });
      }

      // A good day with a crack in the glass: he tapes it up.
      if (reaction.tier !== 'meltdown' && game().repairIfDue()) await tapeTheGlass();
    } finally {
      setBusy(false);
    }
  };

  /** Repair moment (blueprint 4.4): he walks up and tapes the glass himself. */
  const tapeTheGlass = async (line?: string) => {
    const canvas = office.current;
    if (!canvas) return;
    setStatus('Vinnie is walking up to the glass…');
    zoomTo(canvas.headPositionAt(CAMERA_SPOT), ZOOM_MS);
    await canvas.walkTo(CAMERA_SPOT);
    canvas.play('repair');
    setStatus(ANIM_STATUS.repair);
    await sleep(1800);
    canvas.play('idle');
    await say(line ?? pick(callbacks.repair));
    zoomTo(null, 700);
    await canvas.walkTo(DESK_SPOT);
    setStatus(ANIM_STATUS.idle);
  };

  /** Playtest button: repair now, skipping the once-a-day rule. */
  const repairGlass = async () => {
    if (!office.current || busy || crackLevel === 0) return;
    setBusy(true);
    setUserZoom(0);
    try {
      game().repairNow();
      await tapeTheGlass();
    } finally {
      setBusy(false);
    }
  };

  // On opening: a promise kept for a week, or a gap since the last receipt.
  const checkedPromises = useRef(false);
  useEffect(() => {
    if (checkedPromises.current || !office.current) return;
    checkedPromises.current = true;
    const kept = game().collectKeptPromises();
    let greet: (() => void) | null = null;
    if (kept.length) {
      const category = getCategory(kept[0].category).label.toLowerCase();
      greet = () => {
        office.current?.play('celebrate');
        say(fillPlaceholders(pick(callbacks.promiseKept), { category }));
      };
    } else if (entries.length) {
      // Soft streaks: a gap is noticed with a joke, never punished.
      const last = entries.reduce((a, e) => (e.date > a ? e.date : a), '');
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      if (last <= toDateKey(twoDaysAgo)) greet = () => say(pick(callbacks.gap));
    }
    if (!greet) return;
    const id = setTimeout(greet, 1500);
    return () => clearTimeout(id);
    // Runs once the office is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.width]);

  // Taps in the office: props get a line from Vinnie, the floor gets a walk.
  const lastLines = useRef<Partial<Record<PropTarget, string>>>({});
  const tapStreak = useRef(NO_TAPS);
  const lastFedUp = useRef<string | undefined>(undefined);
  const catStreak = useRef(NO_TAPS);
  const catRunning = useRef(false);
  const lastCatLine = useRef<string | undefined>(undefined);
  const onSceneTap = async (t: TapTarget) => {
    const canvas = office.current;
    if (!canvas || busy) return;
    // Counted before the bubble check: poking him mid-sentence is the whole point.
    if (t.kind === 'vinnie') {
      tapStreak.current = tapped(tapStreak.current);
      if (tapStreak.current.count >= FED_UP_TAPS) {
        tapStreak.current = NO_TAPS;
        const line = pickFedUpLine(heat, lastFedUp.current, Math.random);
        lastFedUp.current = line;
        bubble?.done();
        canvas.play('shout');
        await say(line);
        office.current?.play('idle');
        return;
      }
    }
    if (t.kind === 'prop' && t.target === 'cat') {
      if (catRunning.current) return;
      catStreak.current = tapped(catStreak.current);
      const taps = catStreak.current.count;
      const line = pickCatLine(taps, heat, lastCatLine.current, Math.random);
      lastCatLine.current = line;
      bubble?.done();
      if (taps === 1) {
        const at = canvas.catPosition();
        await say(line, at ? { at, speaker: 'Luc' } : undefined);
        return;
      }
      if (taps === 2) {
        canvas.alert(900);
        await say(line);
        return;
      }
      catStreak.current = NO_TAPS;
      game().catTeased();
      canvas.alert(1400);
      canvas.play('shout');
      if (!reducedMotion) {
        catRunning.current = true;
        canvas.runCat().then(() => {
          catRunning.current = false;
        });
      }
      await say(line);
      office.current?.play('idle');
      return;
    }
    if (bubble) return;
    if (t.kind === 'floor') {
      setStatus(ANIM_STATUS.walk);
      await canvas.walkTo(t.at);
      return;
    }
    const target: PropTarget = t.kind === 'vinnie' ? 'vinnie' : t.target;
    const line = pickPropLine(target, room, lastLines.current[target], Math.random);
    lastLines.current[target] = line;
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

  // A quick-add link (vinnie://add?...) shows a pre-filled receipt once Vinnie is free;
  // a sit-down notification opens the sit-down.
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
      : pendingSitdown && !busy
        ? { kind: 'sitdown' }
        : null);

  // Share: a pill offers the moment for a few seconds after a crack, call or achievement.
  const [sharePrompt, setSharePrompt] = useState<ShareMoment | null>(null);
  const [sharing, setSharing] = useState<ShareMoment | null>(null);
  const offerShare = (m: ShareMoment) => setSharePrompt(m);
  useEffect(() => {
    if (!sharePrompt) return;
    const id = setTimeout(() => setSharePrompt(null), SHARE_PROMPT_MS);
    return () => clearTimeout(id);
  }, [sharePrompt]);
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        const a = s.toasts[0];
        if (a && a !== prev.toasts[0]) {
          setSharePrompt({ kind: 'achievement', name: a.name, description: a.description });
        }
      }),
    [],
  );

  // Straight from onboarding: the first receipt, a scripted meltdown (or a normal
  // reaction for an essential), the free repair, the shop, then the notification ask.
  useEffect(() => {
    if (!onboardingScript || busy || !office.current || scene.width === 0) return;
    const id = setTimeout(async () => {
      const { entry, reaction, scripted } = onboardingScript;
      game().clearOnboardingScript();
      if (scripted) {
        const values = {
          amount: formatMoney(entry.amountMinor, 'USD', { trimZeroCents: true }),
          category: getCategory(entry.category).label.toLowerCase(),
        };
        const line = entry.isExample
          ? onboarding.meltdown[heat]
          : fillPlaceholders(onboarding.meltdownReal[heat], values);
        await play(entry, {
          ...reaction,
          tier: 'meltdown',
          line,
          escalation: heat === 'gentle' ? 'knock' : 'punch',
          call: {
            ...onboarding.call,
            scriptId: onboarding.call.id,
            declineRetry: calls.declineRetry,
          },
        });
        if (game().character.crackLevel > 0) {
          setBusy(true);
          game().repairNow({ quiet: true });
          await tapeTheGlass(onboarding.repair);
          setBusy(false);
        }
      } else {
        await play(entry, reaction);
      }
      track('onboarding_step', { step: 'shop' });
      await say(onboarding.shop);
      track('onboarding_step', { step: 'notifications' });
      setNotifyAsk(true);
    }, 900);
    return () => clearTimeout(id);
    // play/say/tapeTheGlass read fresh refs; the script is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingScript, busy, scene.width]);

  const answerNotifyAsk = async (yes: boolean) => {
    setNotifyAsk(false);
    const allowed = yes ? await game().setNotificationsEnabled(true) : false;
    await say(allowed ? onboarding.notifyThanks : onboarding.notifySkip);
  };

  // Opened from a "Vinnie is calling…" notification: he calls to check in.
  useEffect(() => {
    if (!pendingCheckIn || busy) return;
    const id = setTimeout(async () => {
      const canvas = office.current;
      game().clearPending();
      if (!canvas) return;
      setBusy(true);
      try {
        canvas.play('phone');
        setStatus('Vinnie is calling you…');
        game().callPlaced();
        await ring(
          { ...calls.checkIn, scriptId: calls.checkIn.id, declineRetry: calls.declineRetry },
          null,
        );
        canvas.play('idle');
        setStatus(ANIM_STATUS.idle);
      } finally {
        setBusy(false);
      }
    }, 800);
    return () => clearTimeout(id);
    // game() and ring are stable store accessors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCheckIn, busy]);

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
    () => roomState(entries, limit, new Date(), mood),
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
        <Pressable
          style={styles.gear}
          onPress={() => setSheet({ kind: 'settings' })}
          disabled={busy}
          accessibilityLabel="Settings"
        >
          <Text style={styles.gearLabel}>⚙︎</Text>
        </Pressable>
        <Pressable
          style={styles.budget}
          onPress={() => setSheet({ kind: 'budget' })}
          accessibilityRole="button"
          accessibilityLabel={
            'Budget: ' +
            formatMoney(spent) +
            ' spent' +
            (limit === null ? '' : ' of ' + formatMoney(limit)) +
            (share > 1 ? ', over budget' : share >= 0.85 ? ', nearly at the limit' : '')
          }
        >
          <Text style={styles.budgetLabel}>This month</Text>
          <Text style={[styles.budgetAmount, share > 1 && styles.over]}>
            {/* A symbol as well as a colour, for colour-blind users. */}
            {share > 1 ? '✕ ' : share >= 0.85 ? '⚠ ' : ''}
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
      <View style={styles.statusRow}>
        <MoodBar mood={mood} />
        <Pressable
          style={styles.coinButton}
          onPress={() => setSheet({ kind: 'shop' })}
          disabled={busy}
          accessibilityLabel={'Appease Vinnie. ' + coins + ' coins'}
        >
          <Text style={styles.coinLabel}>🪙 {coins}</Text>
          <Text style={styles.gift}>🎁</Text>
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
                cosmetics={cosmetics}
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
                speaker={bubble.speaker}
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
          <Chip label="+100 coins" onPress={() => game().grantDebugCoins(100)} />
          <Chip label="Sit-down" onPress={() => setSheet({ kind: 'sitdown' })} />
          {entries.length > 0 && (
            <Chip
              label="Share card"
              onPress={() => {
                const last = entries[entries.length - 1];
                setSharing({
                  kind: 'crack',
                  line: `Over budget AND $${(last.amountMinor / 100).toFixed(2)}?! That's IT.`,
                  amountMinor: last.amountMinor,
                  description: last.description,
                  category: last.category,
                });
              }}
            />
          )}
          <Chip label={`Repair (${crackLevel})`} onPress={repairGlass} />
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

      {(sitdownReady || sharePrompt) && (
        <View style={styles.prompts}>
          {sitdownReady && !busy && (
            <Pressable style={styles.prompt} onPress={() => setSheet({ kind: 'sitdown' })}>
              <Text style={styles.promptLabel}>☕ Weekly sit-down</Text>
            </Pressable>
          )}
          {sharePrompt && !busy && (
            <Pressable
              style={styles.prompt}
              onPress={() => {
                setSharing(sharePrompt);
                setSharePrompt(null);
                track('share_opened', { kind: sharePrompt.kind });
              }}
            >
              <Text style={styles.promptLabel}>📸 Share this moment</Text>
            </Pressable>
          )}
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
          accessibilityRole="button"
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
      <SettingsSheet
        visible={shown?.kind === 'settings'}
        onClose={() => setSheet(null)}
        // Fresh install again: the office redirects to onboarding.
        onDeleted={() => setSheet(null)}
      />
      <SitdownSheet
        visible={shown?.kind === 'sitdown'}
        onClose={() => {
          setSheet(null);
          game().clearPending();
        }}
        onDone={() => {
          setSheet(null);
          office.current?.play('celebrate');
          setStatus('Vinnie enjoyed the sit-down.');
        }}
      />
      <ShareSheet moment={sharing} onClose={() => setSharing(null)} />
      {notifyAsk && (
        <View style={styles.ask}>
          <Text style={styles.askLine}>{onboarding.notifyAsk}</Text>
          <View style={styles.askButtons}>
            <Pressable style={styles.askNo} onPress={() => answerNotifyAsk(false)}>
              <Text style={styles.askNoLabel}>{onboarding.notifyNo}</Text>
            </Pressable>
            <Pressable style={styles.askYes} onPress={() => answerNotifyAsk(true)}>
              <Text style={styles.askYesLabel}>{onboarding.notifyYes}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ShopSheet
        visible={shown?.kind === 'shop'}
        onClose={() => setSheet(null)}
        onBought={(line) => {
          setSheet(null);
          office.current?.play('celebrate');
          say(line);
        }}
      />
    </SafeAreaView>
  );
}

const chipLabel = (c: QuickChip) => c.description || getCategory(c.category).label;

const MOOD_COLOR = {
  proud: '#4E9F5A',
  relaxed: '#7DB25A',
  suspicious: '#E2A93B',
  angry: '#D9822B',
  meltdown: '#C0392B',
};

/** Segmented mood meter with his state label (blueprint Screen 1 header). */
function MoodBar({ mood }: { mood: number }) {
  const state = moodState(mood);
  const segments = 12;
  const lit = Math.round((mood / 100) * segments);
  return (
    <View
      style={styles.mood}
      accessibilityRole="progressbar"
      accessibilityLabel={`Vinnie's mood: ${MOOD_LABEL[state]}`}
      accessibilityValue={{ min: 0, max: 100, now: mood }}
    >
      <Text style={styles.moodLabel}>Mood</Text>
      <View style={styles.moodTrack}>
        {Array.from({ length: segments }, (_, i) => (
          <View
            key={i}
            style={[
              styles.moodSegment,
              { backgroundColor: i < lit ? MOOD_COLOR[state] : colors.line },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.moodState, { color: MOOD_COLOR[state] }]}>{MOOD_LABEL[state]}</Text>
    </View>
  );
}

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
  ask: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: 110,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  askLine: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  askButtons: { flexDirection: 'row', gap: space.sm },
  askNo: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  askNoLabel: { fontWeight: '800', color: colors.ink },
  askYes: {
    flex: 1,
    backgroundColor: colors.mustard,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  askYesLabel: { fontWeight: '800', color: colors.ink },
  gear: { padding: space.sm, marginLeft: 'auto', marginRight: space.sm },
  gearLabel: { fontSize: 22, color: colors.inkSoft },
  prompts: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  prompt: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  promptLabel: { color: colors.card, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  coinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  coinLabel: { fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  gift: { fontSize: 16 },
  mood: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  moodLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  moodTrack: { flex: 1, flexDirection: 'row', gap: 2 },
  moodSegment: { flex: 1, height: 10, borderRadius: 2 },
  moodState: { fontSize: 12, fontWeight: '800', minWidth: 72, textAlign: 'right' },
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
