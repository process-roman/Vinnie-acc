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

**M6 (retention and sharing)** — opt-in, in-character notifications (weekly sit-down,
a check-in call, a late-month warning, a nudge after two quiet days; one a day, quiet hours,
backs off when ignored). The weekly sit-down walks through your week and pays 20 coins.
Share cards of cracks, calls and achievements, with amounts hidden unless you turn them on.
Settings (⚙︎) has heat level, notifications and the iPhone Apple Pay Shortcut guide.
Everything from M1–M5 is still here; tap the "Vinnie" title for playtest controls.
