# Performance (blueprint 8.5)

Targets: 60 fps in the office on a mid-range Android phone; cold start under 2.5 s.

## What's been measured

Only in the web build so far (the dev bundle in the desktop browser pane). Not
representative of a phone: the pane throttles timers and frames when it's in the background,
and the dev bundle isn't minified.

| Measurement | Result | Notes |
|---|---|---|
| Office fps (web, foreground) | 40–60 fps | Frame counter in the office's top-left corner |
| Dev web bundle | ~4.4 MB | Unminified, with source maps off |
| Time to office after reload (web, warm cache) | ~2 s | Includes loading CanvasKit and sql.js wasm |

## Still to measure on a device

- [ ] Office fps on a mid-range Android phone (Expo Go and a release build).
- [ ] Cold start to interactive office on that phone.
- [ ] Meltdown sequence (zoom + punch + crack + call) for dropped frames.

## What keeps it cheap

- Every sprite and wall layer is rasterised once into a small buffer and cached; Skia only
  scales those images (nearest-neighbour) every frame.
- Animation (Vinnie, steam, rain, lightning, the cat) runs off one shared clock on the UI
  thread. Walking and depth-sorting never cause a React re-render.
- The only periodic React update is the fps label, isolated in its own component.

## If a device misses 60 fps

1. Pack all sprites into one atlas image and draw them with Skia's `Atlas` instead of one
   `Image` per sprite frame (each sprite is currently drawn twice for depth sorting).
2. Drop the "behind Vinnie" copy for sprites he can never walk behind.
3. Render the static room (floor, walls, poster, window) into a single picture.
