# Vinnie

A pixel-art budgeting game for iOS and Android. Log what you spend and Vinnie Ledger, a
loud Brooklyn accountant, reacts. Sometimes he punches the screen and calls you.

- Product and dev plan: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Reference material: [docs/reference/](docs/reference/)

## Run it

```bash
npm install
npm start        # Expo dev server (press a for Android, w for web)
npm run web      # web build in the browser
```

## Checks

```bash
npm test
npm run typecheck
npm run lint
```

## Status

**M0 (foundations)** — Expo + TypeScript + Expo Router scaffold, Skia pixel-art renderer
spike (isometric office, animated Vinnie, tap-to-walk, depth sorting) and the full-app crack
overlay spike (3 levels, shake, haptics, taps pass through). The screen at `src/app/index.tsx`
is a test bench with debug buttons.
