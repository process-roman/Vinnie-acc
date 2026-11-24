# Vinnie: App Store listing

Everything to paste into App Store Connect. Name, subtitle, keywords and categories come from
`VINNIE_keywords.xlsx` (option A). Character limits are in brackets.

## App information

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Name [30]          | Vinnie: Roast My Spending                                                                      |
| Subtitle [30]      | Pixel accountant money game                                                                    |
| Bundle ID          | com.processroman.vinnie                                                                        |
| SKU                | vinnie-ios                                                                                     |
| Primary category   | Finance                                                                                        |
| Secondary category | Games › Simulation                                                                             |
| Privacy Policy URL | https://www.getvinnie.app/privacy                                                              |
| Terms of Use       | https://www.getvinnie.app/terms (keep Apple's standard licence agreement in App Store Connect) |
| Support URL        | https://getvinnie.app                                                                          |
| Marketing URL      | https://getvinnie.app                                                                          |
| Copyright          | 2026 (your name or company)                                                                    |

"Vinnie" alone is taken on the App Store (a wine app), so the name must keep the suffix.

## Keywords [100]

```
budget,expense,tracker,funny,no,buy,spend,challenge,impulse,receipt,save,frugal,habit,savage,latte
```

## Promotional text [170]

Can be changed any time without a new review.

```
Meet Vinnie, your new accountant. Stay under budget and he's proud of you. Blow it on a $14 latte and he comes through the glass. Don't poke the cat.
```

## Description [4000]

```
Vinnie is a budget app that yells at you.

He's an old-school accountant with a Brooklyn office, an espresso habit and a cat named Luc. You log what you spend. He reads every receipt. Stay under your limits and he's proud of you. Blow them and he loses it: he shouts, he punches the screen, and when it's bad enough, he calls you.

It's the fastest way to break bad spending habits, because nobody wants to explain a $900 pair of sneakers to Vinnie twice.

SET YOUR LIMITS. VINNIE ENFORCES THEM.
• Set a monthly budget and a limit for each category: coffee, groceries, dining out, delivery, shopping and more.
• Log a purchase in seconds. Vinnie reacts to every one.
• Go over a line and he lets you know. Loudly.

BREAK YOUR BAD SPENDING HABITS
• Watch his office react to your month: the plant thrives or wilts, the weather turns, the mood bar climbs or crashes.
• Sit down with him once a week for a review of where the money went.
• Keep a streak going, earn coins and achievements, and spend them on things for the office: a cannoli, a Persian rug, a bed for Luc.

PICK HOW MAD HE GETS
• Classic: a lecture you'll remember. Unhinged: the words his mother hates, for grown-ups only.

DON'T POKE LUC
• Luc is family. You've been warned.

NO BANK LOGIN. YOUR DATA STAYS ON YOUR PHONE.
• No account, no sign-up, no bank connection.
• Everything you enter is stored on your device only. We don't collect it, see it or sell it.
• Export your purchases to a spreadsheet whenever you want.

Vinnie is pixel art, sound effects and an accountant with opinions. Download it, log your first coffee, and find out what he thinks.

Vinnie is for fun and personal tracking, not financial advice.
Terms: https://www.getvinnie.app/terms
Privacy: https://www.getvinnie.app/privacy
```

## App Privacy (the "nutrition label")

Answer **"No, we do not collect data from this app."** This gives the label "Data Not Collected".

Why that's true for this build:

- Entries, budgets and settings are stored in a database on the device (SQLite) and never uploaded.
- Notifications are scheduled locally. No push server is used.
- Analytics (`src/services/analytics.ts`) send only when `EXPO_PUBLIC_POSTHOG_KEY` is set at build
  time, and it isn't. **If you ever add that key, update the label first:** Usage Data › Product
  Interaction, not linked to identity, not used for tracking.

## Age rating

Answer the questionnaire honestly; it calculates the rating. The parts that matter:

- **Profanity or crude humour: Infrequent / Mild.** Strong language appears only at the
  "Unhinged" heat level, which the user has to switch on in Settings (labelled 17+ there). The
  default, Classic, has none.
- **Mature or suggestive themes:** mild, comic threats in a mob-movie style ("I introduce you to the
  fishes"). No violence is shown beyond a cartoon punch cracking the screen.
- No gambling, no user-generated content, no unrestricted web access.

## Export compliance

`ios.config.usesNonExemptEncryption` is `false` in `app.json`, so App Store Connect doesn't ask
about encryption on each build.

## Notes for App Review

App Review asked for this (Guideline 2.1, information needed). Paste it into App Review Information ›
Notes, and attach the screen recording (or paste a link to it in place of the first line).

```
1. SCREEN RECORDING
Attached: a recording on a physical iPhone (latest iOS), starting from launching the app and showing the typical flow: onboarding, logging purchases, Vinnie's reactions, the in-app call, the budget, history, the shop and settings. The app has no accounts, no login, no user-generated content and no paid content, so there are no such flows to show.

2. PURPOSE AND AUDIENCE
Vinnie is a personal budget tracker for adults who want to spend less on impulse purchases (coffee, delivery, shopping). Most budget apps are easy to ignore. Vinnie turns budgeting into a game: you set a monthly budget and category limits, log what you spend, and a pixel-art cartoon accountant reacts to every purchase. Staying under budget makes him proud and his office thrives; overspending makes him angry, the office falls apart, and he "calls" you. Good habits earn coins and achievements. The value is a fun, emotional nudge to track spending and stick to a budget. It is not financial advice.

3. HOW TO USE IT
No login, account or sample files are needed.
- Launch the app and follow the short onboarding: enter a first name, pick how strict Vinnie is (Gentle, Classic or Unhinged), set a monthly budget, then log a first purchase. Choosing the example purchase shows his biggest reaction: he punches the screen (a cartoon crack over the app) and calls you (a simulated call screen inside the app, not a real phone call), with replies to pick from.
- Main screen: tap "+ New Receipt" to log a purchase. Logging a large one (for example $500 in Shopping) goes over budget and triggers a reaction.
- "Budget" (bottom right): monthly budget and per-category limits. "History" (bottom left): every purchase, with edit and delete.
- Coin button (top right): spend coins earned for tracking on gifts and office items. Coins can't be bought; there are no in-app purchases.
- Settings (gear): strictness level, sound, reminders, and export of all purchases as a CSV file.
- Tap objects in the office, Vinnie, or his cat Luc for comments.

4. EXTERNAL SERVICES
None. The app works fully offline. All data is stored only on the device (SQLite) and is never uploaded. Reminders are local notifications scheduled on the device; there is no server, no analytics, no ads, no AI service and no payment processing.

5. REGIONS
The app works the same in all regions. It is in English, and amounts use US dollar formatting everywhere.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. The app does not connect to banks or provide financial services or advice; it only records what the user types in. All art, characters, text and sounds are original to this app.

Content note: the "Unhinged" level, which the user has to choose, uses strong language and is labelled 17+ in the app. Gentle has no swearing; Classic has mild language.
```

## Screenshots

`npm run screenshots` writes them to `promo/out/screenshots/`.

- iPhone 6.9" display: `appstore-1-yells.png` … `appstore-5-private.png` (1320×2868)
- Google Play phone: `play-*.png` (1080×1920)
