// M0 spike screen: a rough Office layout used to check the renderer and the crack
// overlay against real UI (header, bottom bar, a sheet). Replaced in M2/M3.

import { ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CAMERA_SPOT, OfficeCanvas, OfficeCanvasHandle } from '@/scene/OfficeCanvas';
import { useFx } from '@/store/fx';
import { colors, radius, space } from '@/ui/tokens';

export default function OfficeScreen() {
  const fx = useFx();
  const office = useRef<OfficeCanvasHandle>(null);
  const sceneBox = useRef<ComponentRef<typeof View>>(null);
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState('Vinnie is doing your taxes. Tap around.');
  const [taps, setTaps] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const tap = (label: string) => {
    setTaps((n) => n + 1);
    setStatus(`Tapped ${label}.`);
  };

  const punch = async () => {
    if (busy || !office.current) return;
    setBusy(true);
    setStatus('Vinnie is walking up to the glass…');
    await office.current.walkTo(CAMERA_SPOT);
    office.current.alert(700);
    await new Promise((r) => setTimeout(r, 700));
    const head = office.current.headPosition();
    sceneBox.current?.measureInWindow((x, y) => {
      fx.punch({ x: x + head.x, y: y + head.y });
      setStatus('Vinnie punched the screen.');
      setBusy(false);
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Vinnie</Text>
          <Text style={styles.subtitle}>November</Text>
        </View>
        <Pressable style={styles.budget} onPress={() => tap('the budget pill')}>
          <Text style={styles.budgetAmount}>$1,248</Text>
          <Text style={styles.subtitle}>of $2,000</Text>
        </Pressable>
      </View>

      <View
        ref={sceneBox}
        style={styles.scene}
        onLayout={({ nativeEvent: { layout } }) =>
          setSceneSize({ width: layout.width, height: layout.height })
        }
      >
        {sceneSize.width > 0 && <OfficeCanvas ref={office} {...sceneSize} onEvent={setStatus} />}
      </View>
      <Text style={styles.status}>{status}</Text>

      <View style={styles.debug}>
        <DebugButton
          label={busy ? 'Punching…' : `Punch (crack ${fx.crackLevel}/3)`}
          onPress={punch}
        />
        <DebugButton label="Repair" onPress={fx.repair} />
        <DebugButton
          label={sheetOpen ? 'Close sheet' : 'Open sheet'}
          onPress={() => setSheetOpen((o) => !o)}
        />
      </View>
      <Text style={styles.taps}>UI taps that got through: {taps}</Text>

      <View style={styles.bottomBar}>
        <Pressable style={styles.barItem} onPress={() => tap('History')}>
          <Text style={styles.barLabel}>History</Text>
        </Pressable>
        <Pressable style={styles.mainButton} onPress={() => tap('New Receipt')}>
          <Text style={styles.mainButtonLabel}>+ New Receipt</Text>
        </Pressable>
        <Pressable style={styles.barItem} onPress={() => tap('Budget')}>
          <Text style={styles.barLabel}>Budget</Text>
        </Pressable>
      </View>

      {sheetOpen && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Test sheet</Text>
          <Text style={styles.sheetBody}>
            The crack should draw over this sheet, and these buttons should still work through it.
          </Text>
          <View style={styles.debug}>
            <DebugButton label="Tap me" onPress={() => tap('the sheet button')} />
            <DebugButton label="Close" onPress={() => setSheetOpen(false)} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DebugButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.debugButton} onPress={onPress}>
      <Text style={styles.debugLabel}>{label}</Text>
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
  title: { fontSize: 26, fontWeight: '800', color: colors.brick },
  subtitle: { fontSize: 12, color: colors.inkSoft },
  budget: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    alignItems: 'flex-end',
  },
  budgetAmount: { fontSize: 20, fontWeight: '800', color: colors.ink },
  scene: { flex: 1, justifyContent: 'center' },
  status: { textAlign: 'center', color: colors.inkSoft, marginVertical: space.sm },
  debug: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  debugButton: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  debugLabel: { color: colors.ink, fontWeight: '600' },
  taps: { textAlign: 'center', color: colors.inkSoft, fontSize: 12, marginTop: space.sm },
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sheetBody: { color: colors.inkSoft },
});
