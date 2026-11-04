// Share card (blueprint §12, 7.3): a 9:16 card of the moment with the office,
// Vinnie's line and the logo. Amounts and what you bought stay hidden unless you
// switch them on. Nothing is shared without you pressing Share.

import { ComponentRef, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ShareMoment, shareCardContent } from '@/domain/shareCard';
import { composeSnapshot, scaleNearest } from '@/scene/composition';
import { toPngDataUri } from '@/scene/skiaImage';
import { canShareImages, shareView } from '@/services/share';
import { ROOM_H, ROOM_W, WAYPOINTS } from '@/scene/room';
import type { CrackLevel } from '@/domain/repair';
import { roomState } from '@/domain/roomState';
import { equippedBySlot } from '@/domain/shop';
import { useGame } from '@/store/game';

import { Sheet } from './Sheet';
import { colors, radius, space } from './tokens';

/** Frames from Vinnie's sheet for each kind of moment. */
const POSE = { crack: 16, call: 13, achievement: 7 };
const SNAPSHOT_SCALE = 4;

type Props = { moment: ShareMoment | null; onClose: () => void };

export function ShareSheet({ moment, onClose }: Props) {
  const entries = useGame((s) => s.entries);
  const limit = useGame((s) => s.limitMinor);
  const character = useGame((s) => s.character);
  const inventory = useGame((s) => s.inventory);
  const [showAmount, setShowAmount] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const card = useRef<ComponentRef<typeof View>>(null);

  const snapshot = useMemo(() => {
    if (!moment) return null;
    const buf = composeSnapshot({
      room: roomState(entries, limit, new Date(), character.mood, character.lastUpsetAt),
      cosmetics: equippedBySlot(inventory),
      vinnieFrame: POSE[moment.kind],
      at: moment.kind === 'achievement' ? WAYPOINTS.centre : WAYPOINTS.camera,
      // A crack or call moment always shows at least a hairline crack.
      crackLevel:
        moment.kind === 'achievement' ? 0 : (Math.max(1, character.crackLevel) as CrackLevel),
      crackSeed: character.crackSeed,
    });
    return toPngDataUri(scaleNearest(buf, SNAPSHOT_SCALE));
    // The picture is of the moment; later changes shouldn't redraw it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment]);

  if (!moment)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const content = shareCardContent(moment, { showAmount, showDescription });
  const hasMoney = moment.kind !== 'achievement';

  const share = async () => {
    if (!card.current) return;
    setStatus(null);
    const ok = await shareView(card.current).catch(() => false);
    if (!ok) setStatus('Sharing works in the phone app.');
  };

  return (
    <Sheet visible onClose={onClose}>
      <View style={styles.cardWrap}>
        <View ref={card} collapsable={false} style={styles.card}>
          <Text style={styles.logo}>VINNIE</Text>
          <Text style={styles.headline}>{content.headline}</Text>
          {snapshot && (
            <Image
              source={{ uri: snapshot }}
              style={styles.scene}
              resizeMode="contain"
              accessibilityLabel="Vinnie's office"
            />
          )}
          <Text style={styles.quote}>“{content.quote}”</Text>
          {content.detail && <Text style={styles.detail}>{content.detail}</Text>}
          <Text style={styles.footer}>the budgeting game · your money, his problem</Text>
        </View>
      </View>

      {hasMoney && (
        <>
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Show the amount</Text>
            <Switch value={showAmount} onValueChange={setShowAmount} />
          </View>
          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>Show what I bought</Text>
            <Switch value={showDescription} onValueChange={setShowDescription} />
          </View>
        </>
      )}
      {status && <Text style={styles.status}>{status}</Text>}
      <Pressable onPress={share} style={[styles.button, !canShareImages && styles.dim]}>
        <Text style={styles.buttonLabel}>Share</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cardWrap: { alignItems: 'center', marginBottom: space.md },
  card: {
    width: 220,
    aspectRatio: 9 / 16,
    backgroundColor: '#2B1D16',
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { color: '#F2B53A', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  headline: { color: colors.card, fontWeight: '700', textAlign: 'center' },
  scene: { width: '100%', aspectRatio: ROOM_W / ROOM_H },
  quote: { color: colors.card, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  detail: { color: '#F2B53A', fontWeight: '700' },
  footer: { color: '#CBBBA8', fontSize: 10 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  toggleLabel: { color: colors.ink, fontWeight: '600' },
  status: { color: colors.inkSoft, textAlign: 'center', marginVertical: space.sm },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.mustard,
    borderBottomColor: colors.mustardDark,
    borderBottomWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  dim: { opacity: 0.6 },
  buttonLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
