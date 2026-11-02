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

## 2026-11-02 — M1 hook prototype

**Call UI is an overlay, not a route.** The incoming call and the in-call conversation are
mounted in the root layout between the app and the crack overlay, so the cracked glass stays
on top and the office stays visible behind the call. A `call` route can wrap the same
component later for notification deep links (M6).

**Simplified reaction engine.** `src/domain/reaction/tier.ts` implements the §7.2 tiers with
the reasons behind them (`pushedOverBudget`, `crossed85`, `repeat`, …). Dialogue lines and
call scripts select on those reasons. Mood, cooldowns, the honeymoon period and the promise
ledger are M4; for now every meltdown escalates, which is what the playtest needs to see.
Added a `nearLimit` rule (any discretionary spend while already past 85% is at least
`judge`) — the blueprint table leaves that case at `neutral`.

**State is in memory (zustand).** Nothing survives an app restart yet; SQLite comes in M2.
Replies are recorded (`replies` in the game store) for the promise ledger later.

**Content.** 45 reaction lines and 3 call scripts in `src/content/*.json`, tested so every
placeholder resolves and every tier has a line at every heat. `{Category}` is the
capitalised form of `{category}` for sentence starts.

**Playtest controls.** Tapping the "Vinnie" title shows heat, a "Nearly broke" scenario
(month filled to $1,995 of $2,000 so the next treat goes over), repair and reset. Remove or
hide before beta.

**No sound yet.** No ringtone or crack sound assets; ringing vibrates on native.

**Dev server port.** `.claude/launch.json` uses 8090 because another local Expo project
uses 8081.
