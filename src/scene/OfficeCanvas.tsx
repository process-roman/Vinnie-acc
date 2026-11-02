// Renderer spike (M0 / blueprint 0.2): pixel-art isometric office drawn with
// Skia, an animated sprite, tap hit-testing and Reanimated-driven movement.

import { Canvas, Group, Image, rect, SkImage } from '@shopify/react-native-skia';
import {
  ComponentRef,
  Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GestureResponderEvent, PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Easing,
  SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { depth, gridToScreen, GridPoint, Point, screenToGrid } from './iso';
import { getPixel } from './pixels';
import {
  PropDef,
  PROPS,
  rasterizeBox,
  rasterizeRoom,
  ROOM_H,
  ROOM_ORIGIN,
  ROOM_TILES,
  ROOM_W,
} from './room';
import { PIXEL_SAMPLING, toSkImage } from './skiaImage';
import { buildAlertBubble } from './sprites/bubble';
import {
  buildVinnieIdleSheet,
  IDLE_FRAME_MS,
  IDLE_FRAMES,
  VINNIE_ANCHOR,
  VINNIE_H,
  VINNIE_W,
} from './sprites/vinnie';

const MS_PER_TILE = 260;
const START: GridPoint = { gx: 2.5, gy: 3.5 };
/** Front of the room, closest to the viewer: where he walks to hit the glass. */
export const CAMERA_SPOT: GridPoint = { gx: ROOM_TILES - 1, gy: ROOM_TILES - 1 };

export type OfficeCanvasHandle = {
  walkTo(to: GridPoint): Promise<void>;
  /** Vinnie's head, in this component's layout coordinates. */
  headPosition(): Point;
  alert(ms?: number): void;
};

type Props = {
  width: number;
  height: number;
  onEvent?: (message: string) => void;
  ref?: Ref<OfficeCanvasHandle>;
};

const propCentreDepth = (p: PropDef) =>
  depth({ gx: p.footprint.gx + p.footprint.w / 2, gy: p.footprint.gy + p.footprint.d / 2 });

const clampToRoom = (n: number) => Math.min(ROOM_TILES - 0.4, Math.max(0.4, n));

export function OfficeCanvas({ width, height, onEvent, ref }: Props) {
  // Whole device pixels per art pixel keeps every pixel the same size on screen.
  const ratio = PixelRatio.get();
  const fit = Math.min((width * ratio) / ROOM_W, (height * ratio) / ROOM_H);
  const scale = Math.max(1, Math.floor(fit)) / ratio;
  const canvasW = ROOM_W * scale;
  const canvasH = ROOM_H * scale;
  const offsetX = (width - canvasW) / 2;

  const art = useMemo(() => {
    const vinnie = buildVinnieIdleSheet();
    const props = PROPS.map((def) => {
      const buf = rasterizeBox(def.footprint, def.heightPx, def.colors);
      return { def, buf, image: toSkImage(buf), depth: propCentreDepth(def) };
    });
    return {
      room: toSkImage(rasterizeRoom()),
      vinnie: toSkImage(vinnie),
      vinnieSheetW: vinnie.width,
      bubble: toSkImage(buildAlertBubble()),
      props,
    };
  }, []);

  const gx = useSharedValue(START.gx);
  const gy = useSharedValue(START.gy);
  const frame = useSharedValue(0);
  const fps = useSharedValue(0);

  useFrameCallback((info) => {
    frame.value = Math.floor(info.timeSinceFirstFrame / IDLE_FRAME_MS) % IDLE_FRAMES.length;
    const dt = info.timeSincePreviousFrame;
    if (dt && dt > 0) fps.value = fps.value * 0.95 + (1000 / dt) * 0.05;
  });

  // Top-left of the current frame, snapped to whole art pixels so it never blurs.
  const vx = useDerivedValue(
    () => Math.round(gridToScreen({ gx: gx.value, gy: gy.value }, ROOM_ORIGIN).x) - VINNIE_ANCHOR.x,
  );
  const vy = useDerivedValue(
    () => Math.round(gridToScreen({ gx: gx.value, gy: gy.value }, ROOM_ORIGIN).y) - VINNIE_ANCHOR.y,
  );
  const frameClip = useDerivedValue(() => rect(vx.value, vy.value, VINNIE_W, VINNIE_H));
  const sheetX = useDerivedValue(() => vx.value - frame.value * VINNIE_W);
  const bubbleX = useDerivedValue(() => vx.value + 2);
  const bubbleY = useDerivedValue(() => vy.value - 11);

  const vinnieDepth = useDerivedValue(() => gx.value + gy.value);

  const [alerting, setAlerting] = useState(false);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showAlert = (ms = 1200) => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    setAlerting(true);
    alertTimer.current = setTimeout(() => setAlerting(false), ms);
  };
  useEffect(
    () => () => {
      if (alertTimer.current) clearTimeout(alertTimer.current);
    },
    [],
  );

  const walkTo = (to: GridPoint) =>
    new Promise<void>((resolve) => {
      const target = { gx: clampToRoom(to.gx), gy: clampToRoom(to.gy) };
      const dist = Math.hypot(target.gx - gx.value, target.gy - gy.value);
      const timing = { duration: Math.max(1, dist * MS_PER_TILE), easing: Easing.linear };
      gx.value = withTiming(target.gx, timing);
      gy.value = withTiming(target.gy, timing, (finished) => {
        if (finished) scheduleOnRN(resolve);
      });
    });

  useImperativeHandle(ref, () => ({
    walkTo,
    headPosition: () => ({
      x: offsetX + (vx.value + VINNIE_W / 2) * scale,
      y: (vy.value + 4) * scale,
    }),
    alert: showAlert,
  }));

  // locationX/Y is undefined on web when the target is the canvas, so work from
  // page coordinates and the press area's position instead.
  const pressArea = useRef<ComponentRef<typeof View>>(null);
  const onPress = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    pressArea.current?.measureInWindow((x, y) => onTap((pageX - x) / scale, (pageY - y) / scale));
  };

  /** Handles a tap at art-pixel coordinates. */
  const onTap = (ax: number, ay: number) => {
    if (ax >= vx.value && ax < vx.value + VINNIE_W && ay >= vy.value && ay < vy.value + VINNIE_H) {
      showAlert();
      onEvent?.('You poked Vinnie. He noticed.');
      return;
    }
    const px = Math.floor(ax);
    const py = Math.floor(ay);
    const inArt = px >= 0 && py >= 0 && px < ROOM_W && py < ROOM_H;
    // Front-most prop first, hit-tested by its actual pixels.
    const hit = inArt
      ? [...art.props].sort((a, b) => b.depth - a.depth).find((p) => getPixel(p.buf, px, py)[3] > 0)
      : undefined;
    if (hit) {
      onEvent?.(`Vinnie walks to the ${hit.def.id}.`);
      walkTo(hit.def.standAt);
      return;
    }
    const g = screenToGrid({ x: ax, y: ay }, ROOM_ORIGIN);
    if (g.gx >= 0 && g.gx < ROOM_TILES && g.gy >= 0 && g.gy < ROOM_TILES) {
      onEvent?.('Vinnie paces.');
      walkTo(g);
    }
  };

  // Each prop is drawn both behind and in front of Vinnie; depth picks which copy
  // shows, on the UI thread, so walking never needs a React re-render.
  const sorted = [...art.props].sort((a, b) => a.depth - b.depth);
  const propLayers = (behindVinnie: boolean) =>
    sorted.map((p) => (
      <PropLayer
        key={p.def.id}
        image={p.image}
        propDepth={p.depth}
        vinnieDepth={vinnieDepth}
        behindVinnie={behindVinnie}
      />
    ));

  return (
    <View style={{ width, height: canvasH }}>
      <Pressable
        ref={pressArea}
        onPress={onPress}
        style={{ marginLeft: offsetX, width: canvasW, height: canvasH }}
      >
        <Canvas style={{ width: canvasW, height: canvasH }}>
          <Group transform={[{ scale }]}>
            <Image
              image={art.room}
              x={0}
              y={0}
              width={ROOM_W}
              height={ROOM_H}
              sampling={PIXEL_SAMPLING}
            />
            {propLayers(true)}
            <Group clip={frameClip}>
              <Image
                image={art.vinnie}
                x={sheetX}
                y={vy}
                width={art.vinnieSheetW}
                height={VINNIE_H}
                sampling={PIXEL_SAMPLING}
              />
            </Group>
            {propLayers(false)}
            {alerting && (
              <Image
                image={art.bubble}
                x={bubbleX}
                y={bubbleY}
                width={9}
                height={10}
                sampling={PIXEL_SAMPLING}
              />
            )}
          </Group>
        </Canvas>
      </Pressable>
      <FpsLabel fps={fps} pixelSize={Math.round(scale * ratio)} />
    </View>
  );
}

type PropLayerProps = {
  image: SkImage;
  propDepth: number;
  vinnieDepth: SharedValue<number>;
  /** True for the copy drawn before Vinnie. */
  behindVinnie: boolean;
};

function PropLayer({ image, propDepth, vinnieDepth, behindVinnie }: PropLayerProps) {
  const opacity = useDerivedValue(() => (vinnieDepth.value > propDepth === behindVinnie ? 1 : 0));
  return (
    <Image
      image={image}
      x={0}
      y={0}
      width={ROOM_W}
      height={ROOM_H}
      sampling={PIXEL_SAMPLING}
      opacity={opacity}
    />
  );
}

/** Separate component so its periodic re-render doesn't re-render the scene. */
function FpsLabel({ fps, pixelSize }: { fps: SharedValue<number>; pixelSize: number }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const id = setInterval(() => setText(`${Math.round(fps.get())} fps`), 500);
    return () => clearInterval(id);
  }, [fps]);
  return (
    <Text style={styles.fps} pointerEvents="none">
      {text} · {pixelSize}px/px
    </Text>
  );
}

const styles = StyleSheet.create({
  fps: {
    position: 'absolute',
    top: 4,
    left: 8,
    fontSize: 11,
    color: '#7a6a5a',
    fontVariant: ['tabular-nums'],
  },
});
