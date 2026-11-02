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

**M2 (tracker)** — everything from M1, now saved on the device (SQLite). History groups
receipts by month with search, category filters, edit, delete and "Remove examples". The
Budget sheet has a direct-entry limit, spent / left / per-day / days-left, a category
breakdown and the office legend. Quick chips log your frequent purchases in one tap (with
Undo), and `vinnie://add?amount=12.50&merchant=Starbucks&category=coffee` opens a
pre-filled receipt. Tap the "Vinnie" title for playtest controls.
