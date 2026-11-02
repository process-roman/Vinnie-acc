# VINNIE — notes for Claude Code

Read docs/BLUEPRINT.md before any task. Work only on the step you're given.
Architecture decisions and deviations from the blueprint are in docs/DECISIONS.md.

@AGENTS.md

## Milestones (agreed order, supersedes the blueprint's phase order)

M0 foundations/spikes → M1 hook prototype (crack + call, playtest) → M2 tracker →
M3 office → M4 reaction engine → M5 progression → M6 retention/sharing →
M7 onboarding/polish → M8 beta.

## Art

- The game is **pixel art** (isometric). `docs/reference/*.png` shows what Vinnie and the
  office contain, not the rendering style.
- Art is drawn at low resolution and scaled with nearest-neighbour sampling
  (`PIXEL_SAMPLING`) by a whole number of device pixels. Never smooth-scale sprites.
- Placeholder art is generated in code (`src/scene/pixels.ts`, `src/scene/sprites/`).
- Never copy the original app's (Oleg) art, text or name.

## Rules

- TypeScript strict. No `any` without a comment explaining why.
- Money = integer minor units. Never floats.
- src/domain is pure TS: no React, no DB, no Date.now() (pass `now` in). 100% unit-tested.
- Totals and room state are always calculated from entries and budgets. Never store them.
- All coin grants go through coins.grant(idempotencyKey, ...).
- Dialogue, shop, achievements and call scripts live in src/content/*.json, not in code.
- No financial data in analytics events or logs.
- Respect the heat level: never show a line above the user's heat.
- Crack overlay: pointerEvents none, must not block reading.
- Per-frame animation state lives in Reanimated shared values, not React state.

## Commands

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format`
- `npm start` (Expo dev server), `npm run web`, `npm run android`

## Workflow

- Finish the step's acceptance criteria, run tests, typecheck and lint, commit as
  `feat(<step>): ...`.
- Log architecture decisions in docs/DECISIONS.md.
