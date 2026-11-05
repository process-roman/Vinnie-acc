// Vinnie's office: pixel-art isometric room drawn with Skia. The room shows the
// budget (plant, window weather, poster, receipt pile, espresso, cat), Vinnie runs
// a small animation state machine, and taps are hit-tested per pixel.

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
import {
  GestureResponderEvent,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Easing,
  SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { PropTarget } from '@/domain/propLines';
import type { RoomState } from '@/domain/roomState';
import { isDemo } from '@/services/demo';

import { buf, buildSprites, Cosmetics, roomBuffer, vinnieSheet as sheetFor } from './composition';
import { CharacterBox, characterAt, TAP_SLOP } from './hitTest';
import { gridToScreen, GridPoint, Point, pointOnPath, screenToGrid } from './iso';
import { CAT_PATHS, SceneSprite } from './layout';
import { getPixel, PixelBuffer } from './pixels';
import {
  rasterizeLightning,
  rasterizeNeonSign,
  rasterizePoster,
  rasterizeRug,
  rasterizeSunPatch,
  rasterizeWindow,
  RAIN_FRAMES,
  ROOM_H,
  ROOM_ORIGIN,
  ROOM_TILES,
  ROOM_W,
  WAYPOINTS,
} from './room';
import { PIXEL_SAMPLING, toSkImage } from './skiaImage';
import { ALERT_H, ALERT_W, buildAlertBubble } from './sprites/bubble';
import { CAT_RUN_FRAMES, CAT_RUN_H, CAT_RUN_SHEET, CAT_RUN_W } from './sprites/props';
import { AnimName, ANIM_NAMES, ANIMS, VINNIE_ANCHOR, VINNIE_H, VINNIE_W } from './sprites/vinnie';

const MS_PER_TILE = 260;
const START: GridPoint = WAYPOINTS.chair;
export const CAMERA_SPOT: GridPoint = WAYPOINTS.camera;

// Animation tables as plain arrays so the UI-thread worklets can read them.
const ANIM_FRAMES = ANIM_NAMES.map((n) => ANIMS[n].frames);
const ANIM_MS = ANIM_NAMES.map((n) => ANIMS[n].ms);
const ANIM_LOOP = ANIM_NAMES.map((n) => ANIMS[n].loop);
const IDLE = ANIM_NAMES.indexOf('idle');
const WALK = ANIM_NAMES.indexOf('walk');

const LIGHTNING_EVERY_MS = 4200;
/** Where the top of his head is inside a frame. */
const HEAD_TOP = 4;
const CAT_RUN_MS = 3200;
const CAT_RUN_FRAME_MS = 70;

export type TapTarget =
  { kind: 'vinnie' } | { kind: 'prop'; target: PropTarget } | { kind: 'floor'; at: GridPoint };

export type OfficeCanvasHandle = {
  walkTo(to: GridPoint): Promise<void>;
  play(anim: AnimName): void;
  /** Vinnie's head, in this component's layout coordinates. */
  headPosition(): Point;
  /** Where his head would be if he stood at the grid point. */
  headPositionAt(p: GridPoint): Point;
  position(): GridPoint;
  alert(ms?: number): void;
  /** Top of the cat's head, in this component's layout coordinates, if he's in the room. */
  catPosition(): Point | null;
  /** Sends the cat on a lap of the office; resolves when he's back. */
  runCat(): Promise<void>;
};

type Props = {
  width: number;
  height: number;
  room: RoomState;
  /** Equipped shop items by slot. */
  cosmetics?: Cosmetics;
  onTap?: (t: TapTarget) => void;
  /** Ignore taps, e.g. while a reaction is playing. */
  disabled?: boolean;
  ref?: Ref<OfficeCanvasHandle>;
};

// Images are built once per distinct buffer and reused across renders.
const images = new WeakMap<PixelBuffer, SkImage>();
const img = (b: PixelBuffer) => {
  let i = images.get(b);
  if (!i) {
    i = toSkImage(b);
    images.set(b, i);
  }
  return i;
};
const clampToRoom = (n: number) => Math.min(ROOM_TILES - 0.4, Math.max(0.4, n));

export function OfficeCanvas({ width, height, room, cosmetics = {}, onTap, disabled, ref }: Props) {
  // Whole device pixels per art pixel keeps every pixel the same size on screen.
  const ratio = PixelRatio.get();
  const fit = Math.min((width * ratio) / ROOM_W, (height * ratio) / ROOM_H);
  const scale = Math.max(1, Math.floor(fit)) / ratio;
  const canvasW = ROOM_W * scale;
  const canvasH = ROOM_H * scale;
  const offsetX = (width - canvasW) / 2;
  const offsetY = (height - canvasH) / 2;

  const statics = useMemo(
    () => ({
      bubble: img(buildAlertBubble()),
      lightning: img(buf('lightning', rasterizeLightning)),
      rug: img(buf('rug', rasterizeRug)),
      neonOn: img(buf('neon:on', () => rasterizeNeonSign(true))),
      neonOff: img(buf('neon:off', () => rasterizeNeonSign(false))),
    }),
    [],
  );
  const roomImage = img(roomBuffer(cosmetics));
  const vinnieSheet = sheetFor(cosmetics);

  const windowFrames = useMemo(() => {
    const n = room.weather === 'rain' || room.weather === 'storm' ? RAIN_FRAMES : 1;
    return Array.from({ length: n }, (_, i) =>
      buf(`window:${room.weather}:${i}`, () => rasterizeWindow(room.weather, i)),
    );
  }, [room.weather]);
  const poster = buf(`poster:${room.poster}`, () => rasterizePoster(room.poster));
  const sunPatch = buf(`sun:${room.weather}`, () => rasterizeSunPatch(room.weather));
  const sprites = useMemo(() => buildSprites(room, cosmetics), [room, cosmetics]);

  const clock = useSharedValue(0);
  const fps = useSharedValue(0);
  useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
    const dt = info.timeSincePreviousFrame;
    if (dt && dt > 0) fps.value = fps.value * 0.95 + (1000 / dt) * 0.05;
  });

  // Vinnie: position on the grid, current animation, which way he faces.
  const gx = useSharedValue(START.gx);
  const gy = useSharedValue(START.gy);
  const anim = useSharedValue(ANIM_NAMES.indexOf('sit'));
  const animStart = useSharedValue(0);
  const facing = useSharedValue(1);

  const frame = useDerivedValue(() => {
    const a = anim.value;
    const frames = ANIM_FRAMES[a];
    let k = Math.max(0, Math.floor((clock.value - animStart.value) / ANIM_MS[a]));
    k = ANIM_LOOP[a] ? k % frames.length : Math.min(k, frames.length - 1);
    return frames[k];
  });

  // Top-left of the current frame, snapped to whole art pixels so it never blurs.
  const vx = useDerivedValue(
    () => Math.round(gridToScreen({ gx: gx.value, gy: gy.value }, ROOM_ORIGIN).x) - VINNIE_ANCHOR.x,
  );
  const vy = useDerivedValue(
    () => Math.round(gridToScreen({ gx: gx.value, gy: gy.value }, ROOM_ORIGIN).y) - VINNIE_ANCHOR.y,
  );
  const vinnieDepth = useDerivedValue(() => gx.value + gy.value);
  const frameClip = useDerivedValue(() => rect(vx.value, vy.value, VINNIE_W, VINNIE_H));
  const sheetX = useDerivedValue(() => vx.value - frame.value * VINNIE_W);
  const flip = useDerivedValue(() => {
    const cx = vx.value + VINNIE_W / 2;
    return [{ translateX: cx }, { scaleX: facing.value }, { translateX: -cx }];
  });
  const bubbleX = useDerivedValue(() => vx.value + 6);
  const bubbleY = useDerivedValue(() => vy.value - 18);
  // Cheap neon: lit most of the time, with the odd flicker.
  const neon = useDerivedValue(() => {
    const t = clock.value % 5300;
    return t > 4900 && t < 4980 ? 0 : t > 5040 && t < 5090 ? 0 : 1;
  });
  const flash = useDerivedValue(() => {
    const t = clock.value % LIGHTNING_EVERY_MS;
    return t < 90 || (t > 180 && t < 240) ? 1 : 0;
  });

  // The cat's lap: -1 when he's in his spot, otherwise how far round he's got.
  const catPath = room.cat === 'sleeping' ? CAT_PATHS.sleeping : CAT_PATHS.sitting;
  const catRun = useSharedValue(-1);
  const catSpot = useDerivedValue(() => pointOnPath(catPath, Math.max(0, catRun.value)));
  const catX = useDerivedValue(
    () => Math.round(gridToScreen(catSpot.value, ROOM_ORIGIN).x) - Math.floor(CAT_RUN_W / 2),
  );
  const catY = useDerivedValue(
    () =>
      Math.round(gridToScreen(catSpot.value, ROOM_ORIGIN).y - catSpot.value.lift) - CAT_RUN_H + 1,
  );
  const catClip = useDerivedValue(() => rect(catX.value, catY.value, CAT_RUN_W, CAT_RUN_H));
  const catSheetX = useDerivedValue(
    () => catX.value - (Math.floor(clock.value / CAT_RUN_FRAME_MS) % CAT_RUN_FRAMES) * CAT_RUN_W,
  );
  const catFlip = useDerivedValue(() => {
    const cx = catX.value + CAT_RUN_W / 2;
    return [{ translateX: cx }, { scaleX: catSpot.value.facing }, { translateX: -cx }];
  });
  const catShown = useDerivedValue(() => (catRun.value >= 0 ? 1 : 0));
  const runCat = () =>
    new Promise<void>((resolve) => {
      catRun.value = 0;
      catRun.value = withTiming(1, { duration: CAT_RUN_MS, easing: Easing.linear }, (done) => {
        if (!done) return;
        catRun.value = -1;
        scheduleOnRN(resolve);
      });
    });

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

  const play = (name: AnimName) => {
    anim.value = ANIM_NAMES.indexOf(name);
    animStart.value = clock.value;
  };

  const walkTo = (to: GridPoint) =>
    new Promise<void>((resolve) => {
      const target = { gx: clampToRoom(to.gx), gy: clampToRoom(to.gy) };
      const dist = Math.hypot(target.gx - gx.value, target.gy - gy.value);
      // Screen direction: +gx goes right, +gy goes left.
      const dx = target.gx - gx.value - (target.gy - gy.value);
      if (Math.abs(dx) > 0.05) facing.value = dx < 0 ? -1 : 1;
      if (dist < 0.05) {
        play('idle');
        resolve();
        return;
      }
      play('walk');
      const timing = { duration: dist * MS_PER_TILE, easing: Easing.linear };
      gx.value = withTiming(target.gx, timing);
      gy.value = withTiming(target.gy, timing, (finished) => {
        if (!finished) return;
        if (anim.value === WALK) {
          anim.value = IDLE;
          animStart.value = clock.value;
        }
        scheduleOnRN(resolve);
      });
    });

  useImperativeHandle(ref, () => ({
    walkTo,
    play,
    headPosition: () => ({
      x: offsetX + (vx.value + VINNIE_W / 2) * scale,
      y: offsetY + (vy.value + HEAD_TOP) * scale,
    }),
    headPositionAt: (p) => {
      const feet = gridToScreen(p, ROOM_ORIGIN);
      return {
        x: offsetX + feet.x * scale,
        y: offsetY + (Math.round(feet.y) - VINNIE_ANCHOR.y + HEAD_TOP) * scale,
      };
    },
    position: () => ({ gx: gx.value, gy: gy.value }),
    alert: showAlert,
    catPosition: () => {
      const cat = sprites.find((c) => c.key === 'cat');
      if (!cat) return null;
      return {
        x: offsetX + (cat.x + cat.frames[0].width / 2) * scale,
        y: offsetY + cat.y * scale,
      };
    },
    runCat,
  }));

  const pressArea = useRef<ComponentRef<typeof View>>(null);
  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    // Phones report the tap relative to the canvas. Page coordinates won't do there: on
    // Android, measureInWindow leaves out the status bar, which pushed every tap down
    // past small targets like Vinnie and the cat.
    if (Platform.OS !== 'web') {
      hitTest(locationX / scale, locationY / scale);
      return;
    }
    // locationX/Y is undefined on web when the target is the canvas, so work from
    // page coordinates and the press area's measured box (which includes any zoom).
    pressArea.current?.measureInWindow((x, y, w) => {
      const k = w / ROOM_W;
      if (k > 0) hitTest((pageX - x) / k, (pageY - y) / k);
    });
  };

  /** Finds what's under an art-pixel coordinate, front to back. */
  const hitTest = (ax: number, ay: number) => {
    if (!onTap) return;
    const px = Math.floor(ax);
    const py = Math.floor(ay);
    if (px < 0 || py < 0 || px >= ROOM_W || py >= ROOM_H) return;
    const vDepth = gx.value + gy.value;
    const hits = (s: SceneSprite) => {
      const f = s.frames[0];
      const lx = px - s.x;
      const ly = py - s.y;
      return lx >= 0 && ly >= 0 && lx < f.width && ly < f.height && getPixel(f, lx, ly)[3] > 0;
    };
    const cat = sprites.find((s) => s.key === 'cat');
    const characters: CharacterBox<'vinnie' | 'cat'>[] = [
      { id: 'vinnie', x: vx.value, y: vy.value, w: VINNIE_W, h: VINNIE_H },
    ];
    if (cat) {
      const f = cat.frames[0];
      characters.push({ id: 'cat', x: cat.x, y: cat.y, w: f.width, h: f.height });
    }
    const tapCharacter = (id: 'vinnie' | 'cat') =>
      onTap(id === 'vinnie' ? { kind: 'vinnie' } : { kind: 'prop', target: 'cat' });

    const exact = characterAt(ax, ay, characters);
    if (exact === 'cat') return tapCharacter('cat');
    let onFurniture = false;
    for (const s of [...sprites].reverse()) {
      // Anything behind Vinnie loses to him.
      if (exact === 'vinnie' && s.depth < vDepth) break;
      if (hits(s)) {
        if (s.tap) return onTap({ kind: 'prop', target: s.tap });
        onFurniture = true;
        break;
      }
    }
    if (exact === 'vinnie') return tapCharacter('vinnie');
    // Nothing tappable right under the finger: a near miss on a character still counts.
    const near = characterAt(ax, ay, characters, TAP_SLOP);
    if (near) return tapCharacter(near);
    if (onFurniture) return;
    if (getPixel(windowFrames[0], px, py)[3] > 0) return onTap({ kind: 'prop', target: 'window' });
    if (getPixel(poster, px, py)[3] > 0) return onTap({ kind: 'prop', target: 'poster' });
    const g = screenToGrid({ x: ax, y: ay }, ROOM_ORIGIN);
    if (g.gx >= 0 && g.gx < ROOM_TILES && g.gy >= 0 && g.gy < ROOM_TILES) {
      onTap({ kind: 'floor', at: g });
    }
  };

  const layers = (behindVinnie: boolean) =>
    sprites.map((s) => (
      <SpriteLayer
        key={`${s.key}:${behindVinnie ? 'b' : 'f'}`}
        sprite={s}
        clock={clock}
        vinnieDepth={vinnieDepth}
        behindVinnie={behindVinnie}
        hiddenWhile={s.key === 'cat' ? catRun : undefined}
      />
    ));

  return (
    <View style={{ width, height }}>
      <Pressable
        ref={pressArea}
        onPress={onPress}
        disabled={disabled}
        style={{ marginLeft: offsetX, marginTop: offsetY, width: canvasW, height: canvasH }}
      >
        <Canvas style={{ width: canvasW, height: canvasH }}>
          <Group transform={[{ scale }]}>
            <Image
              image={roomImage}
              x={0}
              y={0}
              width={ROOM_W}
              height={ROOM_H}
              sampling={PIXEL_SAMPLING}
            />
            <Image
              image={img(sunPatch)}
              x={0}
              y={0}
              width={ROOM_W}
              height={ROOM_H}
              sampling={PIXEL_SAMPLING}
            />
            {cosmetics.floor === 'rug' && (
              <Image
                image={statics.rug}
                x={0}
                y={0}
                width={ROOM_W}
                height={ROOM_H}
                sampling={PIXEL_SAMPLING}
              />
            )}
            {cosmetics.sign === 'neon_sign' && (
              <>
                <Image
                  image={statics.neonOff}
                  x={0}
                  y={0}
                  width={ROOM_W}
                  height={ROOM_H}
                  sampling={PIXEL_SAMPLING}
                />
                <Image
                  image={statics.neonOn}
                  x={0}
                  y={0}
                  width={ROOM_W}
                  height={ROOM_H}
                  sampling={PIXEL_SAMPLING}
                  opacity={neon}
                />
              </>
            )}
            {windowFrames.map((f, i) => (
              <FrameImage
                key={`win${i}`}
                image={img(f)}
                index={i}
                count={windowFrames.length}
                frameMs={120}
                clock={clock}
              />
            ))}
            {room.weather === 'storm' && (
              <Image
                image={statics.lightning}
                x={0}
                y={0}
                width={ROOM_W}
                height={ROOM_H}
                sampling={PIXEL_SAMPLING}
                opacity={flash}
              />
            )}
            <Image
              image={img(poster)}
              x={0}
              y={0}
              width={ROOM_W}
              height={ROOM_H}
              sampling={PIXEL_SAMPLING}
            />
            {layers(true)}
            <Group clip={frameClip}>
              <Group transform={flip}>
                <Image
                  image={img(vinnieSheet)}
                  x={sheetX}
                  y={vy}
                  width={vinnieSheet.width}
                  height={VINNIE_H}
                  sampling={PIXEL_SAMPLING}
                />
              </Group>
            </Group>
            {layers(false)}
            <Group clip={catClip}>
              <Group transform={catFlip}>
                <Image
                  image={img(CAT_RUN_SHEET)}
                  x={catSheetX}
                  y={catY}
                  width={CAT_RUN_SHEET.width}
                  height={CAT_RUN_H}
                  sampling={PIXEL_SAMPLING}
                  opacity={catShown}
                />
              </Group>
            </Group>
            {alerting && (
              <Image
                image={statics.bubble}
                x={bubbleX}
                y={bubbleY}
                width={ALERT_W}
                height={ALERT_H}
                sampling={PIXEL_SAMPLING}
              />
            )}
          </Group>
        </Canvas>
      </Pressable>
      {!isDemo && <FpsLabel fps={fps} pixelSize={Math.round(scale * ratio)} />}
    </View>
  );
}

/** One frame of a looping animation; visible only on its turn. */
function FrameImage({
  image,
  index,
  count,
  frameMs,
  clock,
  x = 0,
  y = 0,
  extraVisible,
}: {
  image: SkImage;
  index: number;
  count: number;
  frameMs: number;
  clock: SharedValue<number>;
  x?: number;
  y?: number;
  extraVisible?: SharedValue<number>;
}) {
  const opacity = useDerivedValue(() => {
    const onTurn = count === 1 || Math.floor(clock.value / frameMs) % count === index ? 1 : 0;
    return extraVisible ? onTurn * extraVisible.value : onTurn;
  });
  return (
    <Image
      image={image}
      x={x}
      y={y}
      width={image.width()}
      height={image.height()}
      sampling={PIXEL_SAMPLING}
      opacity={opacity}
    />
  );
}

/**
 * A sprite drawn both behind and in front of Vinnie; depth picks which copy shows,
 * on the UI thread, so walking never needs a React re-render.
 */
function SpriteLayer({
  sprite,
  clock,
  vinnieDepth,
  behindVinnie,
  hiddenWhile,
}: {
  sprite: SceneSprite;
  clock: SharedValue<number>;
  vinnieDepth: SharedValue<number>;
  behindVinnie: boolean;
  /** Hidden while this is 0 or more, e.g. when the sprite's character is off running. */
  hiddenWhile?: SharedValue<number>;
}) {
  const visible = useDerivedValue<number>(() =>
    (hiddenWhile?.value ?? -1) < 0 && vinnieDepth.value > sprite.depth === behindVinnie ? 1 : 0,
  );
  return (
    <>
      {sprite.frames.map((f, i) => (
        <FrameImage
          key={i}
          image={img(f)}
          index={i}
          count={sprite.frames.length}
          frameMs={sprite.frameMs ?? 1000}
          clock={clock}
          x={sprite.x}
          y={sprite.y}
          extraVisible={visible}
        />
      ))}
    </>
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
