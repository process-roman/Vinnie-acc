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

**M5 (progression)** — coins for tracking days, saving and walking away, streaks and
achievements, kept as an idempotent ledger (same-day deletes give them back). 13 achievements
with an unlock toast (one secret). The 🪙 button opens Appease Vinnie: gifts lift his mood,
office items (rug, cat bed, neon sign, deluxe espresso machine, wallpaper, outfits) appear in
the room and stay. Everything from M1–M4 is still here; tap the "Vinnie" title for playtest
controls (including +100 coins).
