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

**M7 (onboarding and polish)** — a first-run onboarding that ends in a scripted crack and
call, a free repair, the shop and the notification ask. Settings has export (CSV, JSON), delete
everything, sound and vibration. Reduce Motion is respected; the budget meter has symbols as
well as colours. Privacy-safe analytics (no amounts ever). 250 dialogue lines and 8 call
scripts. Performance notes are in [docs/PERF.md](docs/PERF.md). Next: beta builds (M8).

## Website

The landing page is in `site/`, with the app in demo mode at `/app`.

```bash
npm run build:site   # builds everything into dist/
npm run site         # serves it locally on http://localhost:8092
```

Vercel builds it from `main` using `vercel.json`. The like counter (`api/likes.js`) needs Upstash
Redis connected to the Vercel project.
