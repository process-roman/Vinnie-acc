# Decisions

## 2026-11-02 — M0 foundations

**Expo SDK 58, routes in `src/app/`.** The current Expo template keeps routes under
`src/app/` instead of the blueprint's root `app/`. Everything else follows blueprint B3
under `src/` (`domain`, `data`, `content`, `scene`, `ui`, `store`, `services`).

**Renderer: Skia, not PixiJS.** The spike draws the office with
`@shopify/react-native-skia` and animates with Reanimated shared values. Pixel art stays
crisp by drawing low-resolution images with nearest-neighbour sampling, scaled by a whole
number of *device* pixels (`PixelRatio`), so every art pixel is the same size on screen.
Not yet measured on a mid-range Android device: the 60 fps acceptance check is still open.

**Placeholder art is generated in code.** Sprites are palette-character grids and the room
and props are rasterised procedurally into RGBA buffers, then turned into `SkImage`s. Real
art can replace any of these with PNGs later without changing the scene code.

**Depth sorting without re-renders.** Each prop is drawn both behind and in front of
Vinnie; a derived opacity on the UI thread picks which copy shows, so walking never
triggers a React render.

**Crack overlay is pixel art too.** It's generated from a seed as line segments, drawn at
1/3 screen resolution and scaled up. Higher levels reveal more of the same crack, so it
spreads rather than changing. It's mounted last in the root layout with
`pointerEvents="none"`, above every screen and sheet.

**Web support.** CanvasKit must load before any Skia module is evaluated, so `index.ts`
loads it and then requires `expo-router/entry`. `public/canvaskit.wasm` is copied by
`postinstall` and not committed. Web output is `single` (no static rendering).

**Taps on the canvas** use `pageX/pageY` minus the press area's window position, because
`locationX/Y` is undefined on web when the target is a canvas.

**Not added yet:** `@testing-library/react-native` doesn't resolve against React 19.3; add
it when a step needs component tests.

## Known environment notes

- Node 22.12 is below Expo SDK 58's minimum (22.13). `expo lint` refuses to run, so
  `npm run lint` calls ESLint directly. Upgrade Node to the current LTS.
- The project lives in OneDrive. `node_modules` (~600 MB) will sync unless the folder is
  moved or excluded.
