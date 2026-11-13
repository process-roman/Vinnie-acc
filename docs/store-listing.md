# Vinnie: App Store listing

Everything to paste into App Store Connect. Name, subtitle, keywords and categories come from
`VINNIE_keywords.xlsx` (option A). Character limits are in brackets.

## App information

| Field              | Value                         |
| ------------------ | ----------------------------- |
| Name [30]          | Vinnie: Roast My Spending     |
| Subtitle [30]      | Pixel accountant money game   |
| Bundle ID          | com.processroman.vinnie       |
| SKU                | vinnie-ios                    |
| Primary category   | Finance                       |
| Secondary category | Games › Simulation            |
| Privacy Policy URL | https://getvinnie.app/privacy |
| Support URL        | https://getvinnie.app         |
| Marketing URL      | https://getvinnie.app         |
| Copyright          | 2026 (your name or company)   |

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

```
Vinnie is a personal budget tracker with a cartoon accountant. No account or login is needed; all data stays on the device.

To see the main feature: complete the short onboarding, then tap "+ New Receipt" and log a large purchase (for example $500 in Shopping). Vinnie reacts, and if you go well over budget he "cracks" the screen and places an in-app call (a simulated call screen, not a real phone call).

The "Unhinged" heat level (Settings, labelled 17+) uses strong language; the default level, Classic, does not.
```

## Screenshots

`npm run screenshots` writes them to `promo/out/screenshots/`.

- iPhone 6.9" display: `appstore-1-yells.png` … `appstore-5-private.png` (1320×2868)
- Google Play phone: `play-*.png` (1080×1920)
