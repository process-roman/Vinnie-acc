// Pixel-styled speech bubble with a typewriter effect (blueprint 3.3).
// First tap finishes the typing, the next one dismisses it.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLoopingSound } from '@/services/sound';

import { colors } from './tokens';

const CHAR_MS = 26;
const MAX_WIDTH = 280;
const MARGIN = 8;

type Props = {
  text: string;
  /** The point the tail points at, in the parent's coordinates. */
  anchor: { x: number; y: number };
  parentWidth: number;
  parentHeight: number;
  /** How long it stays after typing, scaled by length. */
  holdMs?: number;
  onDone: () => void;
  /** Who's talking, for screen readers. */
  speaker?: string;
};

export function SpeechBubble({
  text,
  anchor,
  parentWidth,
  parentHeight,
  holdMs,
  onDone,
  speaker = 'Vinnie',
}: Props) {
  const [shown, setShown] = useState(0);
  const typed = shown >= text.length;
  // Vinnie's voice. Luc makes his own noises.
  useLoopingSound('talk', !typed && speaker === 'Vinnie');

  useEffect(() => {
    if (typed) return;
    const id = setInterval(() => setShown((n) => n + 1), CHAR_MS);
    return () => clearInterval(id);
  }, [typed]);

  useEffect(() => {
    if (!typed) return;
    const id = setTimeout(onDone, holdMs ?? 900 + text.length * 20);
    return () => clearTimeout(id);
  }, [typed, holdMs, text, onDone]);

  // Short lines ("Meow.") get a small bubble.
  const width = Math.min(MAX_WIDTH, parentWidth - MARGIN * 2, 40 + text.length * 12);
  const left = Math.max(MARGIN, Math.min(parentWidth - width - MARGIN, anchor.x - width / 2));
  const tailLeft = Math.max(12, Math.min(width - 24, anchor.x - left - 6));

  return (
    <Pressable
      onPress={() => (typed ? onDone() : setShown(text.length))}
      style={[styles.wrap, { left, width, bottom: parentHeight - anchor.y }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${speaker} says: ${text}`}
    >
      <View style={styles.bubble}>
        {/* Full text keeps the size stable; the typed part is drawn over it. */}
        <Text style={[styles.text, styles.ghost]}>{text}</Text>
        <Text style={[styles.text, StyleSheet.absoluteFill, styles.typed]}>
          {text.slice(0, shown)}
        </Text>
      </View>
      <View style={[styles.tail, { left: tailLeft }]} />
    </Pressable>
  );
}

const BORDER = 3;

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  bubble: {
    backgroundColor: '#FFFAF0',
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  text: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  ghost: { opacity: 0 },
  typed: { margin: 0, paddingHorizontal: 12, paddingVertical: 10 },
  tail: {
    position: 'absolute',
    bottom: 0,
    width: 13,
    height: 13,
    backgroundColor: '#FFFAF0',
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: colors.ink,
    transform: [{ translateY: -3 }, { rotate: '45deg' }],
  },
});
