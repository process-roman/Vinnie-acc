# VINNIE — Product & Development Blueprint

**Version:** 2.0 (MVP)\
**Platform:** iOS and Android\
**Genre:** Financial entertainment / casual simulation / budget tracker\
**Visual style:** Isometric pixel art\
**Development approach:** AI-assisted, built with Claude Code

> **What changed in v2.0**
>
> 1. **Breaking the fourth wall is the core feature.** The screen cracks, Vinnie calls you, and he talks to you directly. These are in the MVP, not saved for later.
> 2. **The office shows the budget.** The plant, the window weather, the espresso poster and the receipt pile show where your budget stands without a chart.
> 3. **Damage persists, and good habits repair it.** Cracks stay until earned away. Coins can't buy repairs.
> 4. **You can answer back.** Dialogue choices, plus a "promise ledger" so Vinnie remembers what you said.
> 5. **Heat levels:** Gentle, Classic, and an opt-in Unhinged mode.
> 6. **Logging takes almost no effort.** Quick chips, a deep-link quick-add (iOS Shortcuts and Wallet automation), a widget, and voice entry later.
> 7. **Good news is loggable.** "I saved" and "I skipped it" entries give Vinnie reasons to be happy.
> 8. **Vinnie reaches out.** In-character notifications, a weekly sit-down, and occasional calls.
> 9. **Sharing is in the MVP.** Share cards of Vinnie's best moments, with amounts hidden by default.
> 10. **Monetization is a subscription later.** No paid coin packs.
> 11. **Smaller MVP scope.** Local-only first, no accounts or backend until after the first playtest.
> 12. **A step-by-step development plan** for Claude Code (Part B).

---

# PART A — PRODUCT

## 1. Product Vision

### Tagline

**Your money. His problem.**

VINNIE is a personal expense-tracking game starring Vinnie Ledger, a loud, sarcastic, old-school Brooklyn accountant who reacts to every money decision the player makes. Sometimes he reacts by punching the screen and calling them.

The player keeps their finances under control while managing an increasingly unpredictable relationship with their accountant.

### Core Product Philosophy

**Entertainment gets users in. Financial improvement makes them stay. Vinnie's personality makes them share.**

The product delivers four things:

1. **Entertainment:** a memorable character who breaks the fourth wall.
2. **Motivation:** achievements, coins, repairs and Vinnie's approval.
3. **Financial awareness:** budgeting, expense history and spending insights.
4. **Shareability:** moments worth posting, without exposing the user's finances.

VINNIE does not replace professional financial advice.

### The Signature Moment

The whole product is designed around one sequence:

> The player logs a dumb purchase → Vinnie reads the receipt → he walks to the glass → **he punches the screen and it cracks across the whole app** → his phone rings → **Vinnie calls the player** → he rants → the player picks a reply → Vinnie answers → **the cracks stay.**

If this sequence lands, the product works. Build it first, polish it most, and test it hardest.

### Target Audience

**Primary:** English-speaking adults aged 18–35 who like memes, casual games, sarcastic humour and unconventional productivity apps.

**Secondary:** Adults aged 35–45 who want simple expense tracking without the complexity of traditional finance apps.

**Initial markets:** United States and Canada.

## 2. Main Character: Vinnie Ledger

### Background

Vinnie Ledger is a Brooklyn accountant who has spent 25 years watching people wreck their finances with unnecessary purchases. He runs a small accounting office above a neighbourhood deli.

He's convinced humanity's greatest problem isn't inflation, taxes or the economy. It's people spending $9 on coffee.

### Specific Traits

Vinnie must feel like a specific person, not a stock "Italian-American wiseguy." Lean on details that belong only to him:

- A calculator watch he checks while you talk.
- A personal grudge against oat milk ("It's not milk. Oats don't have nipples.").
- An office cat named **Luc**. He's a little crazy, and Vinnie would do anything for him.
- A framed photo of his mother, whom he quotes as a financial authority.
- He keeps every receipt you've ever given him, and the pile grows.
- He says "pal," "kid" and "listen to me" a lot. He drops Italian all the time (capiche, mamma mia, basta, madonn', vaffanapoli).

He's fully Italian and once kept the books for the mob. He only ever hints at it and never threatens the player. Avoid accent spelling on every word and gold-chain-as-personality.

### Visual Identity

- Short, stocky character.
- Slicked-back dark hair, thick eyebrows, prominent moustache.
- White shirt with rolled sleeves, suspenders, slightly crooked tie.
- Calculator watch.
- Expressive face and exaggerated gestures.

**Art direction:** true pixel art with consistent pixel scaling, in an isometric environment. No smooth cartoon illustration and no needlessly detailed textures.

### Personality

Loud, dramatic, impatient, sarcastic, proud, and secretly caring. His jokes target questionable spending decisions, never the player's identity or financial hardship. He gets genuinely happy when the player builds good habits, and he's a little embarrassed about it ("I'm proud of you. Don't make this weird.").

### Emotional States

| State | Mood range | Behaviour | Animation |
|---|---|---|---|
| Proud | 80–100 | Celebrates good decisions | Smiles, sips espresso, claps |
| Relaxed | 55–79 | Normal everyday mood | Works, reads newspaper, pets Luc |
| Suspicious | 35–54 | Questions purchases | Raises eyebrow, holds receipt to the light |
| Angry | 15–34 | Reacts to repeated overspending | Shouts, bangs desk, paces |
| Meltdown | 0–14 | Rare dramatic reaction | Throws papers, punches screen, calls |

These are reaction states, not permanent punishments. Mood drifts back toward 50 over time.

### Heat Levels (user setting)

| Level | Description | Default |
|---|---|---|
| **Gentle** | Warm teasing, no shouting, no screen punches (he knocks on the glass instead) | — |
| **Classic** | Shouting, sarcasm, screen cracks, calls. Mild language ("hell," "damn," "what the—") plus "vaffanculo," his one Italian swear | ✅ |
| **Unhinged** | Everything in Classic plus profanity. Opt-in only, with an age confirmation | — |

Every dialogue line is tagged with the lowest heat level it's allowed in. Profanity in Unhinged mode is written by hand and never generated.

### Sample Dialogue

- **Coffee:** "Another latte? At this point Starbucks should give you stock options."
- **Groceries:** "Groceries! Actual food! Look at you, making adult decisions!"
- **Another subscription:** "How many subscriptions you got? You collecting 'em?"
- **Budget exceeded:** "We had a NUMBER. We had an AGREEMENT. What happened?"
- **Good week:** "I'm proud of you. Don't make this weird."
- **Callback (promise ledger):** "Tuesday you told me 'never again.' It's Thursday, pal."
- **Skipped a purchase:** "You walked away from it? Come here. No, I'm not hugging you. Come here though."
- **Savings logged:** "Money going INTO an account? Luc, get the camera."

## 3. Main Environment: Vinnie's Office

The main screen is a small isometric office. It has to feel alive. It's also a live budget display.

### Starting Room

Wooden desk with a vintage computer, receipts and papers, office chair, filing cabinet, espresso machine, wall calendar, Brooklyn window, old rotary telephone, rug, desk lamp, framed accounting certificate, piggy-bank poster, potted plant, wastebasket, and Luc the cat.

### The Room Shows the Budget

Some objects reflect the player's current budget status. The player can read the month at a glance. A small legend in the Budget sheet explains each object.

| Object | Signal | States |
|---|---|---|
| **Plant** | Share of budget spent | Healthy (<60%) → droopy (60–85%) → wilted (85–100%) → dead (>100%) |
| **Window weather** | Same | Sunny → cloudy → raining (≥85%) → thunderstorm (>100%) |
| **Espresso poster** | Over budget | Intact → cracked (>100%) |
| **Receipt pile by the bin** | Number of receipts this month | Grows with each logged expense |
| **Espresso machine** | Vinnie's mood | Steaming when mood ≥ 55 |
| **Luc the cat** | Streak | Sleeps on the radiator during a tracking streak, hides when Vinnie is angry |

The states come from financial data and are never stored separately (see Architecture).

### Environmental Interaction

Vinnie walks between set positions, sits at the desk, examines receipts, answers the phone, makes coffee, looks out the window, paces, celebrates, **walks up to the glass**, and **punches the screen**.

Tapping objects gives small reactions. Tap the plant and Vinnie comments on the budget. Tap the cat and the cat ignores you.

## 4. Breaking the Fourth Wall

This is the product's signature. All three features below are in the MVP.

### 4.1 Screen Crack

- **Trigger:** a Meltdown-level reaction, at Classic heat or above, with a cooldown (see §7).
- **Sequence:** Vinnie walks toward the camera and his sprite scales up. A "!" bubble appears. Wind-up, punch, heavy haptic, a crack sound, a short camera shake, then a crack overlay drawn over the **whole app UI**, including headers and nav.
- **Levels:** the crack has 3 levels (hairline → cracked → shattered). Each meltdown in the same "damage period" escalates one level.
- **Persistence:** cracks stay across sessions until repaired (§4.4).
- **Readability:** the overlay must never block taps or make text unreadable. Keep it at low opacity with no pointer events.
- **Gentle heat:** Vinnie knocks on the glass instead and leaves a small smudge.

### 4.2 Vinnie Calls You

- **In-app call (MVP):** a full-screen "Vinnie — mobile — calling…" screen with Decline and Answer buttons and a ringtone.
  - **Answer:** a call bar shows a timer ("Vinnie · 0:07"). Vinnie rants through 2–4 lines in speech bubbles, the player picks one reply out of 3, and Vinnie delivers a closing line.
  - **Decline:** he calls again 10 seconds later, once. If declined again, he texts in the dialogue bubble: "Real mature." His mood drops a little.
- **Out-of-app call (MVP-light):** a local notification styled as a call ("📞 Vinnie is calling…") with a custom ringtone. Tapping it opens the in-app call screen. Used for proactive check-ins (§9) at most once a week.
- **Not allowed:** CallKit or system-level fake calls. Apple only allows CallKit for real VoIP calls. Use notifications plus the in-app screen.

### 4.3 Answering Back (Reply Choices)

During calls and some reactions, the player picks one of 3 replies. Each reply:

- Triggers a specific comeback from Vinnie.
- Changes mood slightly (an honest reply goes over better than an excuse).
- Is **saved to the promise ledger.**

Standard reply sets:

| Reply | Ledger tag | Vinnie's attitude |
|---|---|---|
| "I needed it." | `excuse_needed` | Skeptical |
| "Won't happen again." | `promise_never_again` | Hopeful, then remembers |
| "It's an investment." | `excuse_investment` | Outraged |
| "Yeah… my bad." | `admit` | Softens |

### 4.4 Damage and Repair

- Cracks **can't be bought away.** Behaviour repairs them.
- **Repair rule (default):** log at least one expense on 3 separate days without a new meltdown trigger. Each qualifying day reduces the crack by one level.
- **Repair moment:** Vinnie gets out tape and a squeegee and patches the glass himself. "Don't tell anyone I did this."
- Purchased office items are **never** destroyed. Cracks are the only lasting damage, and they always heal.

## 5. Core Gameplay Loop

**Log → Vinnie reacts → Room and budget update → (sometimes) crack or call → Progress earned → Repair and appease**

### Step 1: Log

Entry types:

| Type | Example | Effect |
|---|---|---|
| **Expense** | $18 · Coffee & Dining · "Two iced coffees" | Normal reaction |
| **Saved** | $50 → savings | Strong positive reaction, mood up |
| **Skipped it** | Walked away from $120 sneakers | Positive reaction, counts toward "money not spent" stat |

Fields: amount, category, optional description, date (defaults to today).

**Target:** under 5 seconds for a repeat purchase (one tap on a quick chip plus confirm) and under 10 seconds for a new one.

### Step 2: Evaluate

The rule engine looks at category, amount, monthly budget, remaining budget, how many days are left, frequency in the category, similar recent purchases, the promise ledger, and the heat setting.

Essentials, recurring bills, medical costs and necessary large expenses are **never** labelled irresponsible.

### Step 3: React

The engine picks a reaction tier, an animation, a dialogue line, sound and haptics, and whether to escalate (crack, call or both). Most reactions are short (2–3 seconds). Escalations are rare surprises.

### Step 4: Update

The record is saved locally right away. Budget, category totals and room state update right away.

### Step 5: Reward

Coins for logging the first expense, tracking on separate days, doing the weekly sit-down, logging savings or skips, and meeting goals.

**Never** award coins for spending more, fake entries, or repeat logging of the same item. "Saved" and "Skipped" coins are capped per day.

## 6. Screens and Navigation

### Screen 1: Office (Home)

**Header:** Vinnie's name and month, a budget ring (spent / limit), sound toggle, mood bar with its state label, coin balance, gift icon (opens Appease Vinnie).

**Main area:** the isometric office (most of the screen), Vinnie, speech bubbles, status line under the room ("Vinnie is reading your receipt…"), zoom +/–.

**Quick chips:** a horizontal row of the user's 3–6 most frequent recent entries ("Latte $6.50", "Groceries $82"). One tap logs it, with a quick undo toast.

**Bottom bar:** History · **+ New Receipt** (main button) · Budget.

**Design rule:** the office takes up most of the screen. Finance UI must never overpower the character.

### Screen 2: New Receipt (bottom sheet)

1. Type toggle: Expense / Saved / Skipped it.
2. Large amount display with a custom keypad (1–9, 00, 0, backspace).
3. Description field ("What'd you buy? e.g. latte to go").
4. Category chips.
5. Date (defaults to today, tap to change).
6. Confirm button: **"Give Vinnie the Receipt"**.

On submit: close the sheet, go back to the office, play the reaction. While it plays, the main button reads "Vinnie is reading…" and is disabled.

### Screen 3: History (bottom sheet or full screen)

List grouped by month. Each row shows a colored category dot, the description, category and date, the amount, and **the reaction tag Vinnie gave it** (approved, judged, glass punch, call).

Features: edit, delete, filter by category and date, search, monthly totals. Edits recalculate everything. History has to be a useful finance tool on its own.

Example entries from onboarding are labelled "example," with a "Remove examples" button.

### Screen 4: Budget (bottom sheet)

- Monthly limit with –/+ steppers and direct input.
- Progress bar, spent, remaining, days left, daily allowance.
- Spending by category.
- **Room legend:** "The plant wilts as you near the limit," "It rains at 85%," "The espresso poster cracks if you go over," "One crumpled receipt per receipt Vinnie ate."
- Vinnie's take: one evidence-based remark ("You spent $140 on delivery this month. That's a lotta pizza, pal.").

### Screen 5: Appease Vinnie (shop sheet)

Three tabs:

- **Gifts:** treats that raise his mood (espresso, cannoli, pizza, a new newspaper) and office items (better coffee machine, neon "$" sign, rug, new wallpaper, a bed for Luc, outfits for Vinnie).
- **Achievements:** list with progress and rewards.
- **Vinnie+:** *(post-MVP)* subscription info.

Gifts raise mood. Office items are permanent cosmetics in set slots. Gifts never repair cracks.

### Screen 6: Call (full screen, modal)

The incoming-call screen and in-call state described in §4.2.

### Screen 7: Settings

Currency, monthly budget, heat level, sound, haptics, notifications (on/off, quiet hours), quick-add setup guide (iOS Shortcut), export data, delete all data.

## 7. Character Intelligence

### 7.1 Hybrid Reaction Engine

**A. Rule engine (deterministic, local, MVP).** It handles reaction tier, mood change, animation, escalation, coins, achievements, room state, promise-ledger callbacks, and cooldowns.

**B. AI dialogue (optional, post-MVP).** Short, personalized lines generated server-side from structured, minimal context. It must never invent purchase history and must never generate profanity. Every output is checked against tone rules before it's shown. If the AI fails or times out after 1.5 seconds, the app falls back to the line library.

### 7.2 Reaction Tiers

| Tier | When (examples) | Typical result |
|---|---|---|
| `approve` | Essentials, groceries, bills, savings, skips | Happy line, mood +3 to +8 |
| `neutral` | Normal discretionary, within budget | Light comment |
| `judge` | Discretionary purchase that's frequent, large, or late in the month | Suspicious line, mood −3 to −6 |
| `angry` | Repeated discretionary in the same category within 48h, or the purchase that pushes you past 85% | Shouting, mood −6 to −10 |
| `meltdown` | The purchase that pushes you over budget, a broken promise, or a big discretionary purchase while over budget | Screen crack and/or call |

### 7.3 Escalation Cooldowns

- Screen crack: at most once every 48 hours.
- Call: at most once every 72 hours (reactive) and once a week (proactive).
- Never escalate during the user's first 3 days (the honeymoon period). Exception: one scripted escalation in onboarding (§10).
- If an escalation is cooling down, use the strongest animation that's allowed instead.

### 7.4 Promise Ledger (memory)

A local table of the player's replies (tag, category, amount, timestamp). The engine checks it on every new entry:

- `promise_never_again` + same category within 7 days → **broken-promise callback** (forces at least `angry`, and can trigger `meltdown`).
- `excuse_investment` reused within 30 days → a callback line ("Another investment? Your portfolio is pizza.").
- 7 days without the promised category → a pride callback ("A whole week. No sneakers. I noticed.").

### 7.5 Dialogue Library

- **MVP target:** 250–350 hand-written lines.
- Stored as JSON, editable without code changes.
- Each line has: `id`, `text`, `tier`, `minHeat`, `categories[]`, `conditions` (e.g. `overBudget`, `lateMonth`, `brokenPromise`), `weight`, `cooldownDays`, and an optional `replyOptions[]`.
- **No-repeat rule:** a line can't show again until its cooldown passes, and the last 20 shown lines are excluded.
- Lines can include placeholders filled with real data: `{amount}`, `{category}`, `{monthCategoryTotal}`, `{count}`, `{daysLeft}`.

### 7.6 Hard Tone Rules

- No insults about poverty, income, job, body, identity or family.
- No guilt about essentials, medical costs, emergencies, childcare or unavoidable expenses.
- Never make up numbers. Every number Vinnie says comes from the user's records.
- No profanity below Unhinged, except "vaffanculo" in Classic.

## 8. Game Mechanics

### Mood (0–100)

- Starts at 50. Drifts 2 points per day toward 50.
- Changed by reaction tiers, replies, gifts and achievements.
- Separate from financial progress. Mood is presentation, the budget is the truth.

### Coins

In-game currency only. No real-money value and **no paid coin packs.**

Earned for: first receipt (+25), each new tracking day (+5, once a day), a 7-day streak (+30), the weekly sit-down (+20), logging savings or skips (+5, max 2 a day), and achievements.

All coin grants and spending are transactional and can't be duplicated (idempotency keys).

### Streaks

Tracking streaks are **soft.** Missing a day pauses the streak bonus but doesn't reset progress toward achievements. Vinnie notices the gap with humour ("You alive? Blink twice."), not punishment.

### Achievements (initial set)

| ID | Name | Condition | Coins |
|---|---|---|---|
| first_receipt | First Receipt | Log your first expense | 25 |
| answered | Picked Up | Answer Vinnie's call | 30 |
| glass | Glass Jaw | Make Vinnie punch the screen | 20 |
| apology | Honest Word | Pick "Yeah… my bad" | 10 |
| paper_trail | Paper Trail | Track on 5 different days | 30 |
| first_gift | Peace Offering | Buy Vinnie his first gift | 10 |
| seven_sanity | Seven Days of Sanity | 7-day tracking streak | 50 |
| sitdown | The Sit-Down | Complete a weekly review | 20 |
| saver | Into the Vault | Log your first savings | 20 |
| walked_away | Walked Away | Log your first "Skipped it" | 20 |
| repaired | Good as New | Fully repair a crack | 30 |
| under_control | Under Control | Finish a month within budget | 100 |
| secret | ??? | Secret. Something about breakfast. | 25 |

### Surprise Events (low frequency)

- Late-night food delivery, third time in a week → Vinnie calls.
- The printer spits out an absurdly long receipt at month's end.
- Vinnie celebrates a good month with espresso and a little dance.
- The receipt pile collapses during a meltdown.
- Luc knocks something off the desk.

## 9. Proactive Vinnie and Retention

### In-Character Notifications

- At most 1 a day, never during quiet hours (default 22:00–09:00), and always opt-in.
- Types:
  - **Quiet nudge** (no entries for 2 days): "You've been quiet. Too quiet. What'd you buy?"
  - **Late-month warning** (≥85% spent with ≥7 days left): "We got {daysLeft} days and ${remaining}. Walk with me."
  - **Weekly sit-down** (Sunday evening): "Sit down. We need to talk. It's nothin' bad. Probably."
  - **Proactive call** (weekly max): a call-style notification that opens the call screen.
- If the user ignores 3 notifications in a row, frequency drops automatically.

### Weekly Sit-Down

A 30–60 second ritual: Vinnie goes through the week (total spent, top category, best decision, worst decision, promises kept or broken). The player gets coins and a mood boost. This is the main "come back" loop and replaces waiting all month for feedback.

## 10. Onboarding (target: 60–90 seconds)

1. **Meet Vinnie.** "Name's Vinnie. I look after the numbers. You stop doin' stupid things with 'em. Capisce?"
2. **Heat level.** Three cards with a sample line each. Classic is selected by default.
3. **Budget.** "What are we workin' with this month?" Number input in local currency. Can be skipped.
4. **First receipt.** Real entry, or a clearly labelled example.
5. **First reaction.** If the entry looks discretionary (or the user picks the "Show me what he's got" example), play a **scripted** mini-meltdown: crack plus call, with replies. This is the hook, so the user sees the signature moment in the first minute.
6. **Repair preview.** Vinnie tapes the crack right away "just this once," which teaches how repair works.
7. **Office and Appease Vinnie.** Starting coins (+25 achievement) and a shop intro.
8. **Notification permission**, asked in character: "Can I call you sometimes? I promise I'll only yell a little."

No account needed.

## 11. Fast Logging

Logging friction is the biggest risk to retention. Every expense tracker loses most users by week 2 because people forget to log.

| Feature | Phase | Notes |
|---|---|---|
| Quick chips on the office screen | MVP | One tap logs a frequent entry, with an undo toast |
| Custom keypad, remembers last category | MVP | — |
| Deep-link quick add `vinnie://add?amount=&merchant=&category=` | MVP | Opens the New Receipt sheet pre-filled |
| iOS Shortcuts guide plus a downloadable Shortcut | MVP | Uses the Wallet "Transaction" automation (iOS 17+): tap your card → Vinnie opens with amount and merchant pre-filled |
| Home-screen widget (recent chips + "+") | v1.1 | — |
| Native App Intents (iOS) for Siri/Shortcuts | v1.1 | Native module needed |
| Voice entry ("Vinnie, twelve bucks, coffee") | v1.2 | — |
| Android bank-notification reader | v1.2 | Notification listener permission. Play Store policy review needed |
| Receipt scanning, bank sync | v2.0 | — |

Merchant-to-category mapping is learned locally from the user's own edits.

## 12. Sharing

- **Share card (MVP):** after any crack, call or achievement, the user can share a 9:16 image: the cracked office, Vinnie's line, and the VINNIE logo.
- **Amounts hidden by default.** The user can turn them on. Descriptions are never included unless the user chooses to.
- **Video clip (v1.1):** a 5–8 second clip of the meltdown sequence, rendered in the app.
- Nothing is shared automatically.

## 13. Visual, Animation and Sound

### Visual Direction

Isometric pixel art, chunky consistent pixel grid, a limited warm palette (Brooklyn office), readable silhouettes, and a minimal modern UI around the scene. Pixel display font for headings and big numbers, a clean sans-serif for body text.

### Vinnie Sprite Animations (MVP set)

1. Idle breathing
2. Walk (4 directions)
3. Sit at desk
4. Drink coffee
5. Celebrate
6. Raised eyebrow / inspect receipt
7. Angry shout
8. Desk slam
9. Phone call
10. **Walk to camera** (scale-up)
11. **Wind-up and screen punch**
12. **Tape and squeegee repair**

### Overlays and Effects

Crack overlays (3 levels, sized for each device), camera shake, a "!" bubble, rain on the window, plant states.

### Sound and Haptics

Reaction stings, glass crack, ringtone, paper shuffle, coffee machine, rain loop. Haptics: light (log), medium (judge), heavy plus notification pattern (punch). Optional character voice (gibberish "Animalese-style" voice in MVP, real VO later). Everything must also work silently.

## 14. Monetization (post-MVP)

- **No paid coins.** "Pay to calm your accountant down" doesn't fit a budgeting app.
- **Vinnie+ subscription (v1.2+):** voice pack, extra dialogue packs (Holiday Season, Tax Season), premium cosmetic sets, video share clips without a watermark, and later, other characters.
- The core tracker, Vinnie and his escalations stay free.

## 15. Privacy and Security

- Clear privacy policy and consent.
- Local-first: financial data stays on the device in the MVP.
- Export (CSV and JSON) and delete-everything in Settings.
- Once sync exists: secure auth, row-level security, encrypted transport.
- No bank credentials. No financial data in analytics events. Minimal data sent to AI (amounts as buckets or rounded, no free-text descriptions unless needed).
- Share cards hide amounts by default.
- Age rating: profanity only in opt-in Unhinged mode. Set the store age rating to match (likely 12+ or 17+ depending on the store's review).

## 16. Excluded From MVP

Bank connections, receipt scanning, real-money purchases, accounts and cloud sync, AI dialogue, multiple characters, multiplayer, a free furniture-placement editor, investment advice, forecasting, shared household budgets, Android notification reader, video share clips.

## 17. Success Metrics

**The hook:** % of new users who see a crack or call in their first session, % who answer the call, % who share.

**Acquisition:** install → onboarding complete, first expense rate.

**Engagement:** entries per active user, tracking days per week, quick-chip share of entries, weekly sit-down completion, replies chosen.

**Retention:** D1, D7, D30. **Key test:** do users keep logging after they've seen most of the early jokes?

**Financial usefulness:** % with a budget, % finishing a month within budget, savings and skips logged.

**Virality:** shares per 100 weekly active users, installs from shared links.

## 18. Future Versions

- **v1.1:** widget, App Intents, video share clips, more lines and surprise events, more cosmetics.
- **v1.2:** AI-personalized lines, voice entry, character voice, Vinnie+ subscription, Android notification reader, accounts and cloud sync.
- **v2.0:** receipt scanning, optional bank sync, other characters (e.g. a localized accountant for other markets), more rooms.

## 19. Core Product Rule

Every financial action should get an entertaining response, and every entertaining response should nudge better financial awareness.

VINNIE must never become a boring accounting tool with decorative animations.

**The character is the product's identity. The tracking is its foundation. Breaking the fourth wall is why people talk about it.**

---

# PART B — DEVELOPMENT PLAN (for Claude Code)

## B1. How to Use This Plan with Claude Code

- Put this file in the repo root as `docs/BLUEPRINT.md` and add a short `CLAUDE.md` (template in B10).
- Work **one step per session.** Start each session with: "Read docs/BLUEPRINT.md and CLAUDE.md. Do step X.Y. Stop when its acceptance criteria pass."
- Each step lists **deliverables** and **acceptance criteria (AC).** Don't start the next step until the AC pass.
- Commit after every step with the step ID in the message (`feat(3.2): reaction engine tiers`).
- Pure logic (budget math, reaction engine, coins, ledger) **must** have unit tests. UI is checked by running the app.
- Art comes later. Use colored-rectangle placeholder sprites and swap in real art once it's ready, because the scene loads sprites from a manifest.

## B2. Tech Stack (MVP)

| Layer | Choice | Why |
|---|---|---|
| App | **Expo (SDK latest) + React Native + TypeScript (strict)** | One codebase, fast iteration, EAS builds |
| Navigation | **Expo Router** | File-based, simple |
| Game scene | **@shopify/react-native-skia** + **react-native-reanimated** | Native 2D rendering, pixel-perfect sprites, no WebView. Fallback: PixiJS in a WebView if Skia fails the spike |
| Bottom sheets | @gorhom/bottom-sheet | Smooth, well supported |
| Local DB | **expo-sqlite + Drizzle ORM** | Typed schema, migrations |
| State | **Zustand** | Small, simple |
| Haptics / audio | expo-haptics, expo-audio | — |
| Notifications | expo-notifications (local only in MVP) | Call-style alerts, nudges |
| Sharing | react-native-view-shot + expo-sharing | Share cards |
| Deep links | Expo Linking (`vinnie://`) | Quick-add |
| Tests | Jest + @testing-library/react-native | — |
| Analytics | PostHog (no financial properties) | — |
| Crashes | Sentry | — |
| Backend | **None in MVP.** Supabase in Phase 9 | Validate the hook first |

**Money rule:** store all amounts as **integers in minor units** (cents). Never use floats for money.

## B3. Repo Structure

```
vinnie/
  app/                     # Expo Router screens
    (tabs)/index.tsx       # Office
    call.tsx               # Call modal
    settings.tsx
    onboarding/...
  src/
    domain/                # PURE TS, no React. Fully unit tested.
      money.ts             # minor-unit helpers, formatting
      budget.ts            # totals, remaining, % spent, daily allowance
      roomState.ts         # budget → plant/weather/poster/receipts
      reaction/
        engine.ts          # evaluate(entry, context) → Reaction
        tiers.ts
        escalation.ts      # crack / call + cooldowns
        ledger.ts          # promise ledger callbacks
        lineSelector.ts    # pick dialogue line, no-repeat, placeholders
      mood.ts
      coins.ts             # grants, idempotency
      achievements.ts
      repair.ts
      quickChips.ts
    data/
      db.ts                # expo-sqlite + drizzle
      schema.ts
      repositories/*.ts
      seed/examples.ts
    content/
      dialogue/*.json      # line library
      shop.json
      achievements.json
      categories.json
    scene/                 # Skia office
      OfficeCanvas.tsx
      sprites/manifest.ts
      Vinnie.tsx           # state machine → animation
      props/*.tsx
      overlays/Crack.tsx
      camera.ts            # shake, zoom
    ui/                    # sheets, keypad, header, chips, call screen
    store/                 # zustand stores
    services/
      notifications.ts
      share.ts
      deeplink.ts
      analytics.ts
  assets/sprites, assets/sfx, assets/fonts
  docs/BLUEPRINT.md
  CLAUDE.md
```

## B4. Data Model (SQLite)

```
settings(id=1, currency, heat ['gentle'|'classic'|'unhinged'], sound, haptics,
         notifications, quiet_start, quiet_end, onboarding_done, created_at)

entries(id TEXT PK, type ['expense'|'saved'|'skipped'], amount_minor INT,
        currency, category, description, date (YYYY-MM-DD),
        is_example BOOL, reaction_tier, reaction_tag, created_at, updated_at,
        deleted_at NULL)

budgets(month 'YYYY-MM' PK, limit_minor INT, currency)

character_state(id=1, mood INT, last_mood_decay_at, crack_level INT 0–3,
                crack_repair_progress INT, last_crack_at, last_call_at,
                last_proactive_call_at, last_interaction_at)

promise_ledger(id, tag, category, amount_minor, entry_id, created_at,
               resolved ['kept'|'broken'|NULL], resolved_at)

shown_lines(line_id, shown_at)           # no-repeat window

wallet(id=1, coins INT)
coin_tx(id, idempotency_key UNIQUE, delta INT, reason, created_at)

achievements(id PK, progress INT, unlocked_at NULL)

inventory(item_id PK, owned BOOL, equipped BOOL, slot)

notification_log(id, kind, sent_at, opened BOOL)
```

**Rules:**

- Totals and room state are always **calculated** from `entries` and `budgets`, never stored.
- The wallet balance must always equal `SUM(coin_tx.delta)`. Grants go through `coins.grant(key, delta, reason)`, which ignores repeat keys.
- Game state (`character_state`, `wallet`, `achievements`, `inventory`) is kept separate from financial data (`entries`, `budgets`).

## B5. Reaction Engine Contract

```ts
type EntryInput = { type: 'expense'|'saved'|'skipped'; amountMinor: number;
                    category: CategoryId; description?: string; date: string };

type Context = {
  budget: { limitMinor: number|null; spentMinor: number; daysLeft: number; daysInMonth: number };
  categoryStats: { countLast48h: number; countLast7d: number; monthTotalMinor: number };
  ledger: LedgerEntry[];            // open promises / recent excuses
  character: CharacterState;        // mood, crack level, cooldown timestamps
  heat: Heat;
  now: Date;
  isOnboarding: boolean;
  daysSinceInstall: number;
};

type Reaction = {
  tier: 'approve'|'neutral'|'judge'|'angry'|'meltdown';
  moodDelta: number;
  animation: AnimationId;
  lineId: string;               // resolved by lineSelector
  escalation: { crack: boolean; call: boolean; callScript?: CallScript };
  coinGrants: { key: string; delta: number; reason: string }[];
  ledgerEvents: LedgerEvent[];  // e.g. promise broken
  tag: ReactionTag;             // shown in History
};

function evaluate(entry: EntryInput, ctx: Context): Reaction  // PURE, deterministic given a seeded RNG
```

Categories carry a `kind`: `essential` (groceries, bills, rent, transport, health), `discretionary` (coffee, delivery, shopping, entertainment, games, subscriptions), or `mixed`. Essentials can't go above `neutral` unless the amount is far above the user's own average for that category (> 3×).

## B6. Phases and Steps

---

### Phase 0 — Spikes (de-risk first)

**0.1 Project scaffold**

- Expo + TS strict + Expo Router + ESLint/Prettier + Jest. Folder structure from B3. `CLAUDE.md`.
- **AC:** `npx expo start` runs on an iOS simulator and an Android emulator; `npm test` passes with one sample test.

**0.2 Renderer spike (Skia)**

- Draw an isometric floor tile grid, a static office background PNG, and an animated sprite sheet (4-frame idle) with nearest-neighbour scaling (no blur).
- Tap detection on a prop. Move a sprite between two points with Reanimated.
- **AC:** 60 fps on a mid-range Android device (or an emulator profile), crisp pixels at 3× scale, tap hits register. If it fails, switch to PixiJS-in-WebView and record the decision in `docs/DECISIONS.md`.

**0.3 Crack overlay spike**

- A full-screen overlay above *all* UI (root layout) showing a crack PNG/SVG at 3 levels, `pointerEvents="none"`, with camera shake and a heavy haptic.
- **AC:** the overlay sits above sheets and the nav bar, taps pass through, and it looks right on both a small and a large phone.

---

### Phase 1 — Foundation

**1.1 Design tokens and fonts**

- Colors, spacing, radii, pixel display font plus body font, light theme (dark later).
- **AC:** a token file is used by one sample screen. No hard-coded colors in `ui/`.

**1.2 Database and repositories**

- Drizzle schema (B4), migrations, repository functions with tests on an in-memory DB.
- **AC:** CRUD tests pass for entries, budgets, wallet/coin_tx (idempotency test included).

**1.3 Domain: money and budget**

- `money.ts` (parse/format minor units per currency), `budget.ts` (spent, remaining, % spent, days left, daily allowance, category breakdown).
- **AC:** unit tests cover month boundaries, no budget set, over budget, and edits/deletes changing totals.

**1.4 Stores and app shell**

- Zustand stores loading from the DB. Office screen placeholder, header, bottom bar.
- **AC:** the app relaunches with its state intact.

---

### Phase 2 — The Tracker Works Without the Game

**2.1 New Receipt sheet**

- Type toggle, keypad, description, category chips, date, confirm. Remembers last category.
- **AC:** an entry is saved in under 10 seconds from a cold open; validation stops zero/negative amounts.

**2.2 History**

- Grouped list, filter, search, edit, delete (soft delete), reaction tag column, example labels and "Remove examples."
- **AC:** edit and delete update every total right away; search finds by description and category.

**2.3 Budget sheet**

- Limit stepper and input, progress, stats, category breakdown, room legend (static for now).
- **AC:** changing the limit updates the ring and stats live.

**2.4 Quick chips**

- `quickChips.ts`: top 3–6 entries by frequency and recency over the last 30 days (description, category and amount rounded to the user's usual price). Tapping one logs it with an undo toast (5 seconds).
- **AC:** unit tests for ranking; undo removes the entry and any coins granted for it.

**2.5 Deep-link quick add**

- `vinnie://add?amount=12.50&merchant=Starbucks&category=coffee` opens the New Receipt sheet pre-filled. Merchant → category mapping learned from the user's own edits.
- **AC:** works from Safari/Notes on iOS and `adb` on Android; bad parameters are ignored safely.

**Phase 2 exit:** the app is a usable expense tracker with no game features.

---

### Phase 3 — Vinnie's Office

**3.1 Scene composition**

- Office background, prop layer with set slots, Vinnie sprite, z-ordering, idle loop, zoom +/–.
- **AC:** the office fills most of the Office screen on all target sizes.

**3.2 Vinnie state machine**

- States: idle, walk(to), sit, inspect, celebrate, shout, slam, phone, walkToCamera, punch, repair. Waypoints: desk, window, espresso, phone, centre, camera.
- Status line text tied to the state ("Vinnie is reading your receipt…").
- **AC:** a debug menu can trigger every state, and transitions never freeze.

**3.3 Speech bubbles**

- Pixel-styled bubble that follows Vinnie and auto-sizes. Typewriter effect, skippable on tap.
- **AC:** long lines wrap and never go off-screen.

**3.4 Room shows the budget**

- `roomState.ts` (pure, tested), giving plant, weather, poster, receipt pile, espresso steam and cat. Scene props read from it.
- **AC:** changing budget/spending in debug cycles through every state, and the thresholds match §3.

**3.5 Prop interactions**

- Tap the plant, window, cat, phone or espresso machine → a small reaction line.
- **AC:** each prop has at least 3 lines and doesn't repeat back-to-back.

---

### Phase 4 — Reaction Engine and Dialogue

**4.1 Category kinds and tier rules**

- `categories.json` with kinds. `tiers.ts` implements §7.2.
- **AC:** a table-driven test suite with at least 30 scenarios (essentials never judged, repeats escalate, over-budget push → meltdown, and so on).

**4.2 Mood**

- Deltas, clamp 0–100, daily drift toward 50, state mapping.
- **AC:** unit tests; the mood bar in the header updates with the state label.

**4.3 Line library and selector**

- JSON schema (§7.5), loader with validation, selection by tier/category/conditions/heat, weights, no-repeat window, placeholders filled from real data.
- Write the **first 120 lines** (target 250–350 by beta).
- **AC:** tests: never picks a line above the current heat, never repeats within the window, every placeholder resolves (no `{}` showing).

**4.4 Wire-up**

- On submit: evaluate → save the tag on the entry → play animation + line + sound + haptic → update mood/room.
- **AC:** a full reaction plays in under 3 seconds for non-escalated tiers; the main button shows "Vinnie is reading…" meanwhile.

---

### Phase 5 — Breaking the Fourth Wall

**5.1 Screen crack**

- Sequence from §4.1 (walk to camera → "!" → wind-up → punch → shake → crack). Escalating levels, saved in `character_state`. Gentle heat → knock and smudge.
- **AC:** the crack survives an app restart; cooldowns work (unit tested); text stays readable under the overlay.

**5.2 Call screen**

- Full-screen incoming call (avatar, Decline/Answer, ringtone, vibration pattern). In-call state with a timer pill, scripted bubbles, reply choices, closing line, "Call ended · 0:21."
- Call scripts are JSON: `{ id, trigger, minHeat, lines[], replies[{ text, tag, moodDelta, response }], closer }`.
- Decline behaviour from §4.2.
- **AC:** answer and decline paths both work; replies change mood and write to the ledger.

**5.3 Promise ledger**

- `ledger.ts` callbacks (§7.4) feeding into the tier rules and line conditions.
- **AC:** tests: "never again" + same category within 7 days → broken-promise meltdown; a kept promise → pride line after 7 days.

**5.4 Repair**

- `repair.ts` (3 qualifying days → –1 level each). Repair animation and line.
- **AC:** simulated day tests; a full repair grants the "Good as New" achievement.

**5.5 Escalation rules**

- `escalation.ts`: cooldowns, honeymoon period, onboarding scripted exception, fallback to the strongest allowed animation.
- **AC:** unit tests for every rule in §7.3.

---

### Phase 6 — Progression

**6.1 Coins** — the grant table from §8, idempotency keys (`first_receipt`, `day:2026-11-03`, `entry:<id>`), header balance.
**AC:** deleting an entry the same day reverses its entry-based grant; no double grants under fast repeated taps.

**6.2 Achievements** — definitions in JSON, progress tracking, unlock toast ("Achievement: Picked Up +30").
**AC:** every achievement in §8 is reachable in a test scenario.

**6.3 Appease Vinnie shop** — Gifts (mood boost plus a short animation) and Office items (slot-based, permanent, shown in the scene). Achievements tab.
**AC:** buying is atomic (coins can't go below 0); bought items show in the office after a restart.

**6.4 Streaks** — soft streak logic (§8).
**AC:** missing a day pauses the bonus without resetting achievement progress.

---

### Phase 7 — Retention and Sharing

**7.1 Notifications** — local scheduling, quiet hours, max 1 a day, auto-backoff after 3 ignored, call-style notification that deep-links to `call.tsx`.
**AC:** each notification kind can be scheduled and opened from debug; quiet hours are respected.

**7.2 Weekly sit-down** — a scripted review screen in the office (stats + best/worst + promises) with coins.
**AC:** the stats match History for that week exactly.

**7.3 Share cards** — a 9:16 card after a crack, call or achievement; amounts hidden by default with a toggle; system share sheet.
**AC:** the card never contains descriptions or amounts unless the toggle is on.

**7.4 iOS Shortcut guide** — Settings screen explaining the Wallet "Transaction" automation → open `vinnie://add?...`, with a downloadable Shortcut link.
**AC:** tested on a real iPhone with Apple Pay; the amount and merchant arrive pre-filled.

---

### Phase 8 — Onboarding and Polish

**8.1 Onboarding flow** — §10, including the heat picker, scripted first meltdown + call, repair preview, and in-character notification permission.
**AC:** a new user finishes in 60–90 seconds and sees a crack and a call in their first session (unless they chose Gentle).

**8.2 Settings** — everything in Screen 7, plus export (CSV/JSON) and delete-all with confirmation.
**AC:** export opens correctly in a spreadsheet; delete-all brings back a fresh-install state.

**8.3 Sound, haptics, accessibility** — sound/haptic map, reduced motion (no camera shake, crack fades in instead), Dynamic Type for non-pixel text, screen-reader labels, colour-blind-safe budget states (icons as well as colour).
**AC:** usable with VoiceOver/TalkBack; reduced motion respected.

**8.4 Analytics and crash reporting** — PostHog events (`onboarding_step`, `entry_logged{type, via:chip|sheet|deeplink}`, `reaction_shown{tier}`, `crack_shown`, `call_answered`, `reply_chosen{tag}`, `share_opened`, `sitdown_done`) with **no amounts, descriptions or merchants.** Sentry.
**AC:** an event review confirms there are no financial properties.

**8.5 Performance pass** — 60 fps in the office on a mid-range Android, cold start < 2.5 s, sprite atlas packing.
**AC:** measured and recorded in `docs/PERF.md`.

**8.6 Content pass** — dialogue at 250–350 lines; at least 8 call scripts; a tone-rule review of every line.
**AC:** a lint script checks that every line has its required tags and that no banned words appear below Unhinged.

---

### Phase 9 — Beta

**9.1 TestFlight and Play internal testing builds (EAS).**
**9.2 Playtest with 20–30 users for 2 weeks.** Track the §17 metrics. Key question: are people still logging in week 2?
**9.3 Decide on the backend.** If retention holds: add Supabase auth + sync (row-level security, encrypted transport), AI dialogue through an Edge Function, and plan Vinnie+. If not: work on the hook and logging friction before adding infrastructure.

## B7. Definition of Done (MVP)

A user can:

1. Open the app, meet Vinnie and pick a heat level.
2. Set a monthly budget.
3. Log an expense in seconds (chip, sheet or deep link), and log savings or skips.
4. See Vinnie react with dialogue and animation.
5. Have the screen cracked and get a call from Vinnie, then answer back with a reply choice.
6. See Vinnie remember a broken promise.
7. Watch the office reflect the budget (plant, weather, poster, receipts).
8. Repair cracks through good habits.
9. Review, edit, delete and search history.
10. Earn coins, appease Vinnie, and upgrade the office.
11. Get in-character notifications and do a weekly sit-down.
12. Share a card without exposing amounts.
13. Close and reopen the app with nothing lost, fully offline.

## B8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Logging fatigue after week 2 | Quick chips, deep links, iOS Wallet automation, weekly sit-down |
| Jokes get old | 250+ lines, no-repeat window, promise-ledger callbacks, AI variety later |
| Escalations feel punishing | Cooldowns, honeymoon period, repair mechanic, Gentle heat |
| Skia renderer limits | Spike in Phase 0, with a PixiJS WebView fallback |
| App Store rejection (fake calls, profanity) | No CallKit; profanity is opt-in; correct age rating |
| Financial data leakage | Local-first, no analytics properties, share cards hide amounts |
| Stereotyped character | Specific traits (§2), tone review in 8.6 |

## B9. Art and Content Track (runs alongside development)

| When | Deliverable |
|---|---|
| Before Phase 3 | Office background, Vinnie idle/walk sheets, 6 props with states |
| Before Phase 5 | Walk-to-camera, punch, phone, repair animations; 3 crack overlays; call avatar |
| Before Phase 6 | 12 gifts, 10 office items, 3 outfits |
| Before Phase 8 | Full SFX set, app icon, store screenshots, the 250–350 dialogue lines, 8+ call scripts |

Until art is ready, the sprite manifest points to placeholder rectangles with labels.

## B10. CLAUDE.md Template

```md
# VINNIE — notes for Claude Code

Read docs/BLUEPRINT.md before any task. Work only on the step you're given.

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

## Commands
- npm test, npm run lint, npx expo start

## Workflow
- Finish the step's acceptance criteria, run tests and lint, commit as `feat(<step>): ...`.
- Log architecture decisions in docs/DECISIONS.md.
```
