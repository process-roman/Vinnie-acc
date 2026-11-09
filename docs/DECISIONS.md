# Decisions

## 2026-11-02 — M0 foundations

**Expo SDK 58, routes in `src/app/`.** The current Expo template keeps routes under
`src/app/` instead of the blueprint's root `app/`. Everything else follows blueprint B3
under `src/` (`domain`, `data`, `content`, `scene`, `ui`, `store`, `services`).

**Renderer: Skia, not PixiJS.** The spike draws the office with
`@shopify/react-native-skia` and animates with Reanimated shared values. Pixel art stays
crisp by drawing low-resolution images with nearest-neighbour sampling, scaled by a whole
number of _device_ pixels (`PixelRatio`), so every art pixel is the same size on screen.
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

## 2026-11-02 — M2 tracker

**Plain SQL instead of Drizzle.** Repositories talk to a four-method `Db` interface
(`src/data/db.ts`) with hand-written SQL and a numbered migration list tracked by
`PRAGMA user_version`. On devices it's backed by `expo-sqlite`; on web and in Jest by
`sql.js` (the same SQLite, compiled to wasm). That keeps the SQL identical everywhere and
lets repository tests run in Node against a real in-memory database. Drizzle would add a
build step and a second schema language for little gain at this size.

**Web database.** `expo-sqlite` on web needs `.wasm` Metro config and
cross-origin-isolation headers. Instead, web loads `public/sql-wasm-browser.js` (copied by
`postinstall`, not committed) and saves the database to `localStorage` after each change.
It's for development and demos, not a shipping target.

**Writes go through the store.** The zustand store updates state immediately and queues the
matching database write; writes run in order and failures are logged. The store loads
everything at launch (`init()`), and the Office shows paper until it's ready.

**Budgets carry forward.** A month without its own budget uses the most recent earlier
month's limit. First launch sets $2,000 until onboarding asks (M7).

**Soft deletes.** Deleted entries keep their row with `deleted_at`, ready for sync later.

**Quick chips** need at least two matching purchases (same category and description) in the
last 30 days, ranked by frequency then recency, at the most common price. Tapping one logs
it and Vinnie reacts; Undo (5 s) deletes the entry.

**Quick-add links** use an Expo Router route: `vinnie://add?amount=&merchant=&category=`
opens `src/app/add.tsx`, which parses the parameters (invalid ones are dropped), looks up a
learned category for the merchant when none is given, and hands a pre-fill to the Office.
Merchant names are normalised (`STARBUCKS #1234` → `starbucks`) and learned from every
logged or edited entry's description.

**Room legend is static.** The Budget sheet explains the plant, rain, poster and receipt
pile, which the office starts showing in M3.

## 2026-11-02 — M3 office

**Room state is derived.** `src/domain/roomState.ts` turns entries + budget into plant,
weather, poster, receipt pile, espresso and cat states (thresholds from blueprint §3). Mood
doesn't exist until M4, so "upset" means the latest receipt was `angry` or `meltdown` within
the last two hours: the espresso machine goes cold and Deductible hides. The cat sleeps on
the desk during a tracking streak of 2+ days.

**Layered scene.** The base room is bricks and floor only. Window weather (sun, clouds,
3-frame rain, storm with lightning) and the piggy-bank poster are separate wall layers in
the same pixel space. Furniture and props are sprites with a slot (grid point, anchor, lift)
and a depth; items on furniture sort just in front of it. Every sprite is drawn behind and
in front of Vinnie, and a UI-thread opacity picks the copy, so walking never re-renders.

**Animation.** One shared clock drives everything (Vinnie, steam, the cat's tail, rain,
lightning). Vinnie's poses are row overrides on his base sprite; the animation table
(`ANIMS`) lists frames, speed and looping. He faces left or right by flipping the sprite.

**Taps.** Hit-testing is per pixel, front to back, then the window and poster, then the
floor. Props get a line from `src/content/props.json` (never the same twice in a row);
the cat's line goes to the status bar instead of a bubble.

**Idle life.** When nothing is happening Vinnie walks between waypoints every 7–13 s
(chair, espresso, window, plant, centre). Paused while playtest controls are open.

**Repair preview.** The playtest "Repair" button now plays the blueprint's repair moment:
he walks to the glass, tapes it, and says so. The behaviour that earns repairs is M4.

## 2026-11-02 — M4 Vinnie's brain

**Mood** (`src/domain/mood.ts`): 0–100, starts at 50 ("Suspicious"), drifts 2 points a day
toward 50 (applied at launch, partial days carry over). Tier deltas: approve +5, judge −4,
angry −8, meltdown −12; saved +8, skipped +6. Replies: admit +4, "won't happen again" +2,
"I needed it" −2, "it's an investment" −4. Declining a call −3. A kept promise +6. The room
now reads mood instead of M3's two-hour stand-in: the espresso steams at 55+ and the cat hides
below 35, as the blueprint says.

**Escalation** (`escalation.ts`): only meltdowns escalate. Glass at most every 48 h, calls at
most every 72 h, decided separately (he can call without cracking, or crack without calling).
Nothing escalates in the first 72 h after install. When both are cooling down the meltdown
plays as `angry` (desk slam) instead, and is stored that way.

**Promise ledger** (`ledger.ts`): every call reply is recorded. "Won't happen again" plus an
expense in that category within 7 days breaks the promise: at least `angry`, and a meltdown if
the purchase was already a problem (judge or worse). A broken promise has its own call script.
"It's an investment" is remembered for 30 days and gets callback lines. A promise kept for a
full week gets a pride line the next time the office opens. Essentials never trigger any of
this.

**Crack and repair** (`repair.ts`): the crack lives in `character_state` and survives
restarts; the impact point is stored as a fraction of the window. Each later day where you log
something and nothing was a meltdown takes it down one level (a full crack takes three good
days), with the tape-and-squeegee repair moment. The blueprint's text says both "3 days" and
"each day −1 level"; this reads it as one level per qualifying day.

**Line library** is at 120 lines plus 4 call scripts, with tests for placeholders, heat, and a
banned-word check below Unhinged.

**Playtest controls.** "Nearly broke" also ends the honeymoon and clears cooldowns, so the
meltdown always escalates in a demo. "Repair" skips the once-a-day rule.

## 2026-11-02 — M5 progression

**Coins are a ledger.** `coin_tx` has a unique idempotency key per grant; the wallet is
always `SUM(delta)`. Grants: first entry of a day +5 (`day:<date>`), saved/skipped +5 at most
twice a day (`entry:<id>`), a 7-day streak +30 once per streak (`streak7:<start>`), and each
achievement's coins (`ach:<id>`). Spending is a negative row inside a transaction that checks
the balance, so it can't go below zero. Deleting an entry (or Undo) the same day adds a
reversal row for that entry's coins; later deletes keep them. The blueprint's "first receipt
+25" is the First Receipt achievement, not a separate grant, so it isn't paid twice.

**Achievements.** Six are derived from entries (first receipt, 5 tracked days, 7-day streak,
first save, first skip, the breakfast secret); seven count events (call answered, glass
punched, "my bad", first gift, weekly sit-down, full repair, a month within budget). Progress
only goes up, so deleting entries never takes an achievement away. "Under Control" is checked
at launch against last month. "The Sit-Down" unlocks once M6's weekly review exists.

**Soft streaks.** The 7-day streak and its achievement use the best run ever; a gap pauses the
bonus but takes nothing back. After two quiet days Vinnie notices with a joke on opening.

**Shop.** Gifts (espresso, newspaper, cannoli, pizza) lift his mood and never touch the glass.
Office items are slot-based and permanent: rug (floor), cat bed (Deductible sits in it),
neon "$" (wall, flickers), deluxe espresso machine, green wallpaper, and two outfits (blue tie,
Sunday vest) that are colour swaps on his sprite sheet. One item per slot; bought items can be
put away and used again. No paid coin packs.

## 2026-11-02 — M6 retention and sharing

**Notifications are planned, not fired ad hoc.** `src/domain/notifications.ts` plans the next
7 days from the current state (pure, tested): the Sunday 18:00 sit-down, a weekly check-in
call (Thursday 18:30, skipped if he called in the last 72 h), a late-month warning (85%+ spent
with a week left), and a quiet nudge after two days without a receipt. At most one a day, never
in quiet hours (22:00–9:00 by default, moved to when they end), and every other day only after
three ignored in a row. The plan is rebuilt at launch and after each receipt; the device
schedule is replaced each time (`expo-notifications`, date triggers). Calls use a high-priority
Android channel. Tapping a notification opens the sit-down or rings the check-in call. Opt-in
only, from Settings; web is a no-op. Custom ringtone sounds still need assets.

**Weekly sit-down.** Weeks run Monday to Sunday. It opens Friday to Sunday (or from its
notification), once a week: spent, receipts, top category, best and worst decision, promises
kept and broken, then +20 coins (`sitdown:<monday>`), mood +6 and "The Sit-Down".

**Share cards.** The office is re-composed as a still pixel image (`scene/composition.ts`,
shared with the live canvas), scaled up 4× and encoded to PNG with Skia, inside a plain RN
9:16 card that `react-native-view-shot` captures for the system share sheet. Amounts are
redacted from his line (`$$$`) and neither the amount nor what you bought appears unless you
switch it on. A "Share this moment" pill appears for 10 s after a crack, a call or an
achievement; nothing is ever shared automatically. Web previews the card only.

**Settings (first part).** Heat level with sample lines, the notification switch, and the
iPhone Shortcut guide: a Wallet automation that opens
`vinnie://add?amount=…&merchant=…`. Export and delete-all come with M7. The Apple Pay flow
needs a real iPhone to verify.

## 2026-11-02 — M7 onboarding and polish

**Onboarding** (`src/app/onboarding.tsx`): meet Vinnie, pick a heat level (Unhinged locked
behind a 17+ tap), set a budget (skippable), then either "Show me what he's got" (a labelled
$14 example cold brew) or a real receipt. The office then plays a scripted first meltdown
whatever the honeymoon says: punch (or knock at Gentle), the first call with replies, a free
"just this once" repair (it doesn't count toward Good as New), the shop intro and the
notification ask in character. An essential as the first real receipt gets a normal reaction
instead. Onboarding is marked done when the receipt is handed over, so quitting mid-sequence
doesn't log it twice. New installs, and anyone after "Delete everything", are redirected to it.

**Settings, finished.** Sound and vibration switches; export receipts as CSV (examples left
out, amounts as exact decimals) or everything as versioned JSON, through the share sheet on
phones and a download on web; "Delete everything" (two taps) wipes entries, Vinnie, coins,
ledger, merchants, notifications and settings and returns to onboarding.

**Accessibility.** Reduce Motion turns off the camera shake and zoom, and fades the crack in
instead. The budget pill has a symbol (⚠ near the limit, ✕ over) as well as colour, and a
full spoken label. Text uses system scaling.

**Analytics without money.** `src/domain/analytics.ts` lists every event and every allowed
value; anything else (amounts, descriptions, merchants) is dropped before sending. Events go
to PostHog only if `EXPO_PUBLIC_POSTHOG_KEY` is set at build time, with a random per-install
id; otherwise they're logged in development. Crash reporting (Sentry) isn't wired up yet: it
needs an account, a DSN and its config plugin.

**Sound.** The switch is saved, but there are still no sound files (ringtone, glass crack,
stings). Haptics follow their switch.

**Content.** 250 reaction lines and 8 reactive call scripts (plus check-in and onboarding
calls); variants for the same reason are picked at random, broken promises first.
`npm run lint:content` checks placeholders, heat tags, coverage and banned words.

## 2026-11-02 — Fix: app failed to open in Expo Go

`index.ts` loaded Skia's web runtime inside `if (Platform.OS === 'web')`. Production exports
drop that branch, but the dev server doesn't, so Android and iOS dev bundles tried to include
CanvasKit and failed on its `require("fs")`. The web loader now lives in `src/boot.web.ts`
(with a no-op `src/boot.ts` for phones), so phones never see it. Check phone bundles against
a running dev server (`/index.ts.bundle?platform=android&dev=true`), not only `expo export`.

## Vinnie's voice (after M7)

**Italian, with a past.** The owner asked for a fully Italian Vinnie who used to work with the
mafia, which replaces the blueprint's "avoid mob jokes". He only hints at it and never threatens
the player. All lines were rewritten; the tone rules in 7.6 still apply.

**Swearing by heat.** The owner chose to allow "vaffanculo" in Classic, the default heat, as an
exception to "no profanity below Unhinged". Gentle gets "vaffanapoli" instead. Every other swear,
Italian or English (cazzo, minchia, fuck), stays Unhinged only, and the content tests enforce this.
Mild words like mannaggia and madonn' are fine below Unhinged. Since the default heat now swears,
check the store age rating answers before the beta (M8).

**Three taps.** Three taps on Vinnie, each within 1.5s of the last, and he tells you off. Taps count
even while he's talking.

**`underBudget` reason.** Lines that say you're under budget require this condition, so he never says
it when it isn't true.

## Art pass: finer pixels, a real office (after M7)

**Twice the resolution.** Tiles went from 16x8 to 32x16 art pixels and the room is now 268x260, so
each art pixel is about 1.3pt on a typical phone instead of about 3pt. Still whole device pixels and
nearest-neighbour. The trade-off: 375pt @2x phones fall to a 2x scale and show the room at about 70%
of the screen width; the zoom buttons cover that.

**Depth.** The floor has a slab, the walls have thickness, and the room casts a soft stepped-alpha
shadow on the ground. Furniture gets contact shadows, and daylight from the window lies on the floor
in sun and cloud.

**Baked vs live furniture.** Anything against a wall is baked into the room image (`scene/furniture.ts`),
which keeps the live sprite count about where it was. Only the desk, the two chairs and small props
are sprites, cropped to their content. Vinnie is never meant to walk behind baked furniture.

**The window is the Brooklyn Bridge.** Sky, weather and lighting still show the budget; the bridge and
Manhattan are drawn in every state. Nothing is copied from the original app: only its pixel density
and ground shadow were used as a reference.

**Not measured yet.** Frame rate on a real phone with the larger images.

## Luc, the poster and contrast (after the art pass)

**The cat is Luc, and he's a he.** The owner renamed Deductible. Earlier notes here use the old name.
One tap: he meows. Two: Vinnie warns you. Three, each within 1.5s: Luc runs a lap of the office, Vinnie
threatens you with the fishes, and his mood drops by 6. The runner is drawn over the furniture, so his
path stays on open floor. He sleeps on the radiator and sits in the patch of sun.

**Threats are jokes about the cat only.** This is the one exception to "he never threatens the player":
absurd, on the owner's request, and only when you keep poking Luc.

**Poster.** The piggy bank became a vintage espresso poster. No Ferrari badge or Godfather art: those
are real trademarks and copyrighted work, which is a store-rejection and legal risk.

**Contrast.** Paler oak floor, redder brick with light mortar, deep green panelling and door, cream
moulding, a dark desk, and a charcoal slab, so things stop blending into one brown.

## Opening scene, taps, declines and the crack

**Android taps.** `measureInWindow` on Android leaves out the status bar while `pageY` doesn't, so every
tap landed about a status bar too low. Big targets still worked; Vinnie and the cat mostly missed. Phones
now use `locationX/Y` relative to the canvas. Vinnie and the cat also accept near misses (`TAP_SLOP`).

**Two heat levels.** Gentle is gone from every screen, and a migration moves anyone on it to Classic. The
`gentle` tag stays in the content and the types: it now just means "fine at every level", which saved
retagging every line. The knock-on-the-glass path in the escalation code can't be reached any more.

**Your name** is stored in settings, on the device, and never goes in analytics.

**Opening scene.** A big head (`VinniePortrait`) over a still body and wall: three mouths, two brows and a
blink, bobbing a whole art pixel at a time while the line types out. Text uses the system monospace, not a
bundled pixel font. There's no voice or typing sound yet.

**Declined calls.** First decline: the warning, the usual mood drop, and it rings again after 5s. Second: 1.5x
the mood drop (rounded up, so -5) and "Kids these days...".

**Crack.** Redrawn as a web: crushed impact, jagged tapering rays with a shadow and a glint, chords between
them, and tinted panes. Drawn at 2pt per pixel instead of 3pt.

## Category limits and custom categories

**Every category has a line** (`domain/categoryLimits.ts`), one number for "too much in one purchase".
It's the user's own number if they set one; otherwise a share of their monthly budget, so it fits any
income; and after four receipts it rises to 1.5x their median if that's higher, capped at 3x the
start. The median stops one mad purchase teaching him that's normal, and the cap stops him getting
talked into anything. Custom categories get the same treatment: the form asks need/want and, optionally,
a number, so there's never a category with no limit.

**Reactions.** Over the line: judging. Over 1.5x: angry. Over 2.5x: meltdown, so the glass and the call, cooldowns allowing. Separately, a month's total in a
category above 6x the line is judged, which catches many small purchases.

**Ceilings.** Health stops at judging, with lines about concern, because of the tone rule on medical costs.
This is the owner's "all categories" with one exception. 'Other' stops at angry, since it could be anything.

**Bills start at 100% of the budget,** because rent is one purchase and it's meant to be big.

**Registry.** `getCategory` is called from a dozen pure functions, so custom categories are registered in
the domain module instead of being passed through all of them. It's the one piece of module state in
`src/domain`. The store calls it on load and on every change.

**Removing a category** archives it. Old receipts need the name.

## Sound

**Modern pixel, soft and calm.** Raw square waves sounded like an early-90s handheld, and the warmer rewrite still came across as dull. The current set is built like modern pixel games: FM bells, wooden mallets and plucked strings, notes from one happy scale, a rounded chiptune pulse only for the coin, and a small reverb on everything. Levels sit low and close together.

**Generated, not recorded.** `scripts/generate-sounds.js` (`npm run sounds`) synthesizes every effect from
waveforms and seeded noise into `assets/sounds`, the same way the placeholder art is drawn in code. So
there's nothing to license, and they can be swapped for recordings by replacing the files.

**Playback** uses expo-audio (`services/sound.ts`). It follows the Sound switch and the phone's silent mode,
mixes with other audio, and asks for no microphone permission. Failures are logged and ignored.

**Vinnie's voice** is one looping babble that plays while his text types, not a sound per letter, which
would mean restarting a player dozens of times a second.

## Spending pie, and sound on Android

**Pie.** History has a "Where it went" tab: a pixel-art ring for a month or all time, with a percent for each
slice. Past six slices the smallest fold into one, percents always add up to 100, and the rows under it give
the name, amount and percent so nothing depends on colour. The 12 category colours aren't fully distinct
(a palette check flags delivery/dining and bills/transport), which is why the gaps and rows matter.

**Sound on Android ignores the ringer.** expo-audio's `playsInSilentMode: false` silently refuses to play on
Android whenever the ringer's on vibrate or silent. Media volume is the convention there, so that setting is
now iPhone-only. Turning the Sounds switch on plays a coin so you can tell right away.

**Luc hides for an hour.** He runs when Vinnie's mood falls into anger and comes back an hour later, even if
Vinnie's still angry, since the mood itself recovers over days. Another fall restarts the hour.

## Website

**One repo.** The landing page is in `site/` (plain HTML, no build). `npm run build:site` exports the app to
`dist/app` and copies the page to `dist`. Phone builds are untouched: the `/app` base path comes from
`app.config.js` only when `VINNIE_SITE=1`, and demo mode from `EXPO_PUBLIC_DEMO` at build time.

**Demo mode** skips setup, starts with a modest month logged, offers four chosen purchases, has no grace
period or cooldowns, hides the playtest controls, and keeps nothing between visits. The app only loads when
someone taps "Try him", so the page itself stays fast.

**Likes** are one number in Upstash Redis behind `api/likes.js`, with no record of who pressed. The only limit
is per browser (localStorage), so someone determined can inflate it: fine for a vanity count, not a metric
to quote. The count starts at 37, the owner's choice, with stored likes added on top. Without Redis set up, the page shows 37, plus one if you've liked it, and nothing is saved.

**Faded cab yellow, not green.** Full cab yellow took too much attention from the app and the text, so it's now a pale version. Why it replaced green: The first version was dark office green. It read as a bank, and pushed the
funny product toward serious. Yellow is loud, says New York, matches the app's main button, and makes the
dark phone and the red office stand out. It also differs clearly from the cream of the app that inspired it.

**Own design.** Inspired by another app's page structure (pitch beside an embedded live demo), with our own
words, colours and art.

**Grawlix in Classic.** The "millionaire" lines say "f*@king" in Classic and the real word in Unhinged. A masked
swear reads as a comic-book joke and stays within "no profanity below Unhinged, except vaffanculo".

## Opening scene backdrop, closing sheets

**Brooklyn at dusk.** The opening scene's plain navy became a pixel-art sunset (`DuskBackdrop`): stepped warm
bands, a striped sun, the skyline lighting up and the bridge in silhouette. It's warmer and more welcoming,
fits the 90s-game feel better than a flat gradient, and keeps the navy dialogue box. Anything sitting
straight on the sky (nameplate, links, the budget number) has a dark backing so it stays readable.

**Sheets close the expected ways.** They weren't native modals, so Android's back gesture went past them.
Now back closes them, the top bar can be swiped down (PanResponder, no new dependency), and there's a close
button. Tapping outside still works. A swipe that starts inside a sheet's list scrolls the list; only the top
bar drags the sheet.
