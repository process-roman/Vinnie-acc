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

**M4 (Vinnie's brain)** — Vinnie has a mood (shown in the header) that receipts, call replies
and declined calls move, and that drifts back toward neutral over time. Meltdowns respect
cooldowns (glass every 48 h, calls every 72 h) and a 3-day honeymoon for new users. He keeps a
promise ledger: break "won't happen again" within a week and he calls you on it; keep it for
a week and he notices. The crack is saved and only heals as you log on later days without a
meltdown, one level per day. 120 dialogue lines. Everything from M1–M3 is still here; tap
the "Vinnie" title for playtest controls.
