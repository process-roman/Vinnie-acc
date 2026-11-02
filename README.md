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

**M1 (hook prototype)** — log a receipt (expense, saved or skipped) and Vinnie reads it
and reacts with a line picked for the tier, category and heat. Go over budget and he walks
up to the glass, the camera zooms in, he punches the screen and calls you: answer, pick a
reply, or decline (he calls back once, then "Real mature."). History and Budget sheets are
simple stand-ins. Tap the "Vinnie" title for playtest controls; "Nearly broke" sets up a
meltdown on the next treat. State is in memory only.
