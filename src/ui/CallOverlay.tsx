// "Vinnie is calling" (blueprint §4.2, 5.2). Mounted in the root layout under the
// crack overlay, so the cracked glass stays on top of the call.

import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Reply } from '@/domain/reaction/dialogue';
import { VinnieAvatar } from '@/scene/VinnieAvatar';
import { useCall } from '@/store/call';
import { equippedBySlot } from '@/domain/shop';
import { track } from '@/services/analytics';
import { useGame } from '@/store/game';

import { colors, radius, space } from './tokens';

const RETRY_MS = 10_000;
const ENDED_MS = 1800;
const CHAR_MS = 24;

type Phase =
  | { kind: 'ringing' }
  | { kind: 'waitingToRetry' }
  | { kind: 'realMature' }
  | { kind: 'talking'; step: number }
  | { kind: 'choosing' }
  | { kind: 'after'; reply: Reply; step: 0 | 1 }
  | { kind: 'ended' };

export function CallOverlay() {
  const current = useCall((s) => s.current);
  // Remount per call so every call starts from the ringing state.
  return current ? <Call key={current.id} /> : null;
}

function Call() {
  const { call, entry } = useCall((s) => s.current)!;
  const hangUp = useCall((s) => s.hangUp);
  const recordReply = useGame((s) => s.recordReply);
  const outfit = useGame((s) => equippedBySlot(s.inventory).outfit);
  const [phase, setPhase] = useState<Phase>({ kind: 'ringing' });
  const [declines, setDeclines] = useState(0);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const seconds = useSeconds(answeredAt, phase.kind !== 'ended');

  // Vibrate while ringing (native only; there's no ringtone asset yet).
  useEffect(() => {
    if (phase.kind !== 'ringing' || Platform.OS === 'web') return;
    Vibration.vibrate([0, 700, 500], true);
    return () => Vibration.cancel();
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind === 'waitingToRetry') {
      const id = setTimeout(() => setPhase({ kind: 'ringing' }), RETRY_MS);
      return () => clearTimeout(id);
    }
    if (phase.kind === 'realMature' || phase.kind === 'ended') {
      const id = setTimeout(hangUp, phase.kind === 'ended' ? ENDED_MS : 2600);
      return () => clearTimeout(id);
    }
  }, [phase.kind, hangUp]);

  const decline = () => {
    // Hanging up on him costs a little mood every time.
    useGame.getState().declined();
    track('call_declined');
    setDeclines(declines + 1);
    setPhase({ kind: declines === 0 ? 'waitingToRetry' : 'realMature' });
  };
  const answer = () => {
    useGame.getState().achievementEvent('answered');
    track('call_answered');
    setAnsweredAt(Date.now());
    setPhase({ kind: 'talking', step: 0 });
  };
  const choose = (reply: Reply) => {
    recordReply(reply.tag, entry);
    setPhase({ kind: 'after', reply, step: 0 });
  };
  const advance = () => {
    setPhase((p) => {
      if (p.kind === 'talking') {
        return p.step + 1 < call.lines.length
          ? { kind: 'talking', step: p.step + 1 }
          : { kind: 'choosing' };
      }
      if (p.kind === 'after') return p.step === 0 ? { ...p, step: 1 } : { kind: 'ended' };
      return p;
    });
  };

  if (phase.kind === 'waitingToRetry') return null;

  if (phase.kind === 'realMature') {
    return (
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={styles.toastWrap}
        pointerEvents="none"
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.toast}>
            <Text style={styles.toastFrom}>Vinnie</Text>
            <Text style={styles.toastText}>{call.declineRetry}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  if (phase.kind === 'ringing') {
    return (
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut} style={styles.ringing}>
        <SafeAreaView style={styles.ringingInner}>
          <View style={styles.caller}>
            <View style={styles.avatarFrame}>
              <VinnieAvatar size={120} outfit={outfit} />
            </View>
            <Text style={styles.callerName}>Vinnie</Text>
            <Pulse>
              <Text style={styles.callerSub}>
                {declines > 0 ? 'calling again…' : 'mobile · calling…'}
              </Text>
            </Pulse>
          </View>
          <View style={styles.callButtons}>
            <CallButton label="Decline" color="#D64541" glyph="✕" onPress={decline} />
            <CallButton label="Answer" color="#3FAE5B" glyph="☎" onPress={answer} />
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  }

  const elapsed = formatClock(seconds);
  const speech =
    phase.kind === 'talking'
      ? call.lines[phase.step]
      : phase.kind === 'choosing'
        ? call.lines[call.lines.length - 1]
        : phase.kind === 'after'
          ? phase.step === 0
            ? phase.reply.response
            : call.closer
          : null;

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.inCall}>
      <SafeAreaView style={styles.inCallInner}>
        <View style={styles.pill}>
          <View style={styles.liveDot} />
          <Text style={styles.pillText}>
            {phase.kind === 'ended' ? `Call ended · ${elapsed}` : `Vinnie · ${elapsed}`}
          </Text>
          {phase.kind !== 'ended' && (
            <Pressable
              onPress={() => setPhase({ kind: 'ended' })}
              style={styles.hangUp}
              accessibilityLabel="Hang up"
            >
              <Text style={styles.hangUpGlyph}>✕</Text>
            </Pressable>
          )}
        </View>

        {speech && (
          <Pressable
            style={styles.speechWrap}
            onPress={phase.kind === 'choosing' ? undefined : advance}
          >
            <View style={styles.speechAvatar}>
              <VinnieAvatar size={44} outfit={outfit} />
            </View>
            <Typed
              key={speech}
              text={speech}
              style={styles.speech}
              onHoldDone={phase.kind === 'choosing' ? undefined : advance}
            />
          </Pressable>
        )}

        {phase.kind === 'choosing' && (
          <Animated.View entering={FadeIn.delay(200)} style={styles.replies}>
            <Text style={styles.repliesLabel}>Say something</Text>
            {call.replies.map((r) => (
              <Pressable
                key={r.tag}
                onPress={() => choose(r)}
                style={({ pressed }) => [styles.reply, pressed && styles.replyPressed]}
              >
                <Text style={styles.replyText}>{r.text}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

/** Typewriter text that calls onHoldDone a while after it finishes typing. */
function Typed({
  text,
  style,
  onHoldDone,
}: {
  text: string;
  style: object;
  onHoldDone?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const typed = shown >= text.length;
  useEffect(() => {
    if (typed) return;
    const id = setInterval(() => setShown((n) => n + 1), CHAR_MS);
    return () => clearInterval(id);
  }, [typed]);
  useEffect(() => {
    if (!typed || !onHoldDone) return;
    const id = setTimeout(onHoldDone, 700 + text.length * 18);
    return () => clearTimeout(id);
  }, [typed, onHoldDone, text]);
  return (
    <View style={styles.speechBox}>
      <Text style={[style, styles.ghost]}>{text}</Text>
      <Text style={[style, styles.typedOver]}>{text.slice(0, shown)}</Text>
    </View>
  );
}

function Pulse({ children }: { children: React.ReactNode }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function CallButton(props: { label: string; color: string; glyph: string; onPress: () => void }) {
  return (
    <View style={styles.callButtonWrap}>
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.callButton,
          { backgroundColor: props.color },
          pressed && { opacity: 0.8 },
        ]}
        accessibilityLabel={props.label}
        accessibilityRole="button"
      >
        <Text style={styles.callGlyph}>{props.glyph}</Text>
      </Pressable>
      <Text style={styles.callButtonLabel}>{props.label}</Text>
    </View>
  );
}

function useSeconds(since: number | null, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null || !running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [since, running]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const styles = StyleSheet.create({
  ringing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(29, 23, 20, 0.96)',
  },
  ringingInner: { flex: 1, justifyContent: 'space-between', paddingVertical: space.xl * 2 },
  caller: { alignItems: 'center', gap: space.sm, marginTop: space.xl },
  avatarFrame: {
    padding: space.md,
    backgroundColor: '#3A2E28',
    borderRadius: radius.lg,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  callerName: { color: '#FFFAF0', fontSize: 34, fontWeight: '800' },
  callerSub: { color: '#CBBBA8', fontSize: 16 },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: space.xl,
  },
  callButtonWrap: { alignItems: 'center', gap: space.sm },
  callButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callGlyph: { color: '#fff', fontSize: 30, fontWeight: '800' },
  callButtonLabel: { color: '#FFFAF0', fontSize: 14 },

  inCall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(29, 23, 20, 0.55)',
  },
  inCallInner: { flex: 1, paddingHorizontal: space.lg },
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#1D1714',
    borderRadius: radius.pill,
    paddingLeft: space.md,
    paddingRight: 4,
    paddingVertical: 4,
    marginTop: space.md,
    minHeight: 36,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3FAE5B' },
  pillText: { color: '#FFFAF0', fontWeight: '700', fontVariant: ['tabular-nums'] },
  hangUp: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D64541',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangUpGlyph: { color: '#fff', fontWeight: '800' },
  speechWrap: {
    marginTop: space.xl * 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  speechAvatar: {
    backgroundColor: '#3A2E28',
    borderRadius: radius.sm,
    padding: 4,
    overflow: 'hidden',
  },
  speechBox: {
    flex: 1,
    backgroundColor: '#FFFAF0',
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 4,
    padding: space.md,
  },
  speech: { fontSize: 18, fontWeight: '700', color: colors.ink, lineHeight: 24 },
  ghost: { opacity: 0 },
  typedOver: { position: 'absolute', left: space.md, top: space.md, right: space.md },
  replies: { marginTop: 'auto', gap: space.sm, paddingBottom: space.lg },
  repliesLabel: { color: '#FFFAF0', fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  reply: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderBottomWidth: 4,
    borderBottomColor: colors.line,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  replyPressed: { backgroundColor: colors.line },
  replyText: { fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center' },

  toastWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  toast: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    backgroundColor: '#1D1714',
    borderRadius: radius.md,
    padding: space.md,
  },
  toastFrom: { color: '#CBBBA8', fontSize: 12, fontWeight: '700' },
  toastText: { color: '#FFFAF0', fontSize: 16, fontWeight: '700' },
});
