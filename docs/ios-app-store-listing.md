# App Store listing content (iOS)

Paste-ready text for App Store Connect. Character limits are Apple's; counts are
checked by `scripts/check-ios-listing.sh`. Never mention Android, Google Play or
other platforms in any field (Apple rejects that), and don't claim "#1" or "best".

## App information

| Field | Value | Limit |
| --- | --- | --- |
| Name | `Mentto: Tutor Lessons & Fees` | 30 |
| Subtitle | `Students, attendance, payments` | 30 |
| Bundle ID | `app.nexusdigitallabs.mentto` | |
| SKU | `mentto-ios-001` | |
| Primary category | Business | |
| Secondary category | Productivity | |
| Copyright | `2026 Nexus Digital Labs` | |
| Content rights | Does not contain third-party content | |
| Age rating | 4+ (answer "None"/"No" to every question; see below) | |

If the name is taken, keep `Mentto` plus a different suffix (for example
`Mentto: Tutor Planner`). The subtitle and keywords carry the search weight.

## Promotional text (editable any time without a review)

```
Your students, lessons, attendance and fees in one place, with a reminder before every class and due date. Free for up to 8 students. No account and no ads.
```

## Description

```
Mentto is the planner for independent tutors, music teachers and coaches. Your students, lessons, attendance and fees in one place, with a reminder before every class and every due date.

YOUR TEACHING DAY AT A GLANCE
- Today shows your lessons, who's coming and who owes fees
- Mark attendance in a tap, or mark a whole group class at once

LESSONS THAT RUN THEMSELVES
- Set a weekly slot once; it repeats every week or every other week
- Book extra one-off lessons any time
- Move or cancel a single lesson without touching the rest
- Group classes: one class, every student, attendance for each

FEES THAT ADD UP
- Monthly, per-term or per-lesson fees
- Record payments by cash, bank transfer or card
- See who's overdue, who's due today and what's coming up
- Send a polite reminder or a receipt through WhatsApp, SMS or email

REMINDERS
- A heads-up before each lesson, and on the morning a fee falls due

PRIVATE BY DESIGN
- No account needed and no ads. Your students' details stay on your iPhone
- Export your records to a spreadsheet any time

MENTTO PRO
Free covers up to 8 students and 1 group. Pro adds:
- Unlimited students and groups
- Automatic backup to your own Google Drive
- Income reports: by month, by student and by payment method
- PDF receipts and monthly statements
- Your own wording for reminders and receipts

Try Pro free for 7 days, then subscribe monthly or yearly, or pay once for lifetime. If Pro ends, nothing is locked or deleted.

Payment is charged to your Apple Account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel them in your Apple Account settings.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://nexusdigitallabs.dev/mentto/privacy-policy/
```

## Keywords (comma separated, no spaces)

```
teacher,music,coach,tuition,class,schedule,planner,reminder,receipt,private,piano,lesson plan
```

Apple indexes the name and subtitle separately, so don't spend keyword characters on
"Mentto", "Tutor", "Fees", "Students" or "Attendance"; plurals are wasted too.

## What's new (version 1.0.0 first release)

```
Welcome to Mentto on iPhone. Keep your students, lessons, attendance and fees in one place, with a reminder before every class and due date.
```

## URLs

| Field | URL |
| --- | --- |
| Support URL | https://nexusdigitallabs.dev/contact/ |
| Marketing URL | https://nexusdigitallabs.dev/mentto/ |
| Privacy Policy URL | https://nexusdigitallabs.dev/mentto/privacy-policy/ |

For the licence agreement, keep Apple's standard EULA (the description links to it).

## App Review information

- **Sign-in required:** No. Mentto has no accounts, so there is no demo login.
- **Notes for the reviewer:**

```
Mentto has no accounts and no server. Tap Get started, choose a currency and start using it; everything is stored on the device. To see a realistic day, add a student from the Students tab, then add a weekly lesson and a fee plan on the student's page.

To review the purchases: Settings > Upgrade to Pro shows the paywall with the monthly and yearly subscriptions (7-day free trial) and the one-time Lifetime purchase. Restore purchases and the Privacy Policy and Terms of Use links are on the same screen. Pro unlocks unlimited students and groups, income reports, PDF receipts, message templates and automatic backup.

Google sign-in is optional and is not a login to Mentto. It appears only when turning on Pro backup (Settings > Google Drive backup) or restoring (Restore from Google Drive on the first screen), and is used only to save a backup file to the private app folder of the user's own Google Drive (scope drive.appdata). The app works fully without it, and it creates no account with us.

Notifications are local reminders scheduled on the device. Nothing is pushed from a server.
```

- **Contact:** the name, phone and email you enter in App Store Connect. Use
  `hello@nexusdigitallabs.dev`, not a LetsBridge address.

## In-app purchases

Subscription group: `Mentto Pro` (both subscriptions go in this one group).

| Field | Monthly | Yearly | Lifetime |
| --- | --- | --- | --- |
| Type | Auto-renewable | Auto-renewable | Non-Consumable |
| Reference name | Mentto Pro Monthly | Mentto Pro Yearly | Mentto Pro Lifetime |
| Product ID | `mentto_pro_monthly` | `mentto_pro_yearly` | `mentto_pro_lifetime` |
| Duration | 1 month | 1 year | |
| Price (USD base) | 3.99 | 29.99 | 59.99 |
| Introductory offer | Free, 1 week, all territories | Free, 1 week, all territories | none |
| Display name | `Mentto Pro Monthly` | `Mentto Pro Yearly` | `Mentto Pro Lifetime` |
| Description | `Unlimited students, reports and backup` | `Unlimited students, reports and backup` | `Pay once and keep Pro forever` |
| Review screenshot | `store/ios-review/paywall.png` | same | same |
| Review notes | `Settings > Upgrade to Pro.` | same | same |

Same USD prices as Google Play. Family Sharing: leave off. Attach all three to the first
version's "In-App Purchases and Subscriptions" section, or review won't see them.

## App Privacy ("nutrition label")

Answer "Yes, we collect data from this app". Matches the Google Play Data safety answers
(`docs/PLAY_STORE.md`, Part 9d) and RevenueCat's App Privacy page (checked 2026-11-04).
Re-check after any SDK update. No tracking: no ads, no analytics and no advertising identifier.

| Data type (Apple category) | Linked to user | Used to track | Purposes | Source |
| --- | --- | --- | --- | --- |
| Purchases: Purchase History | No | No | App Functionality, Analytics | RevenueCat, anonymous id |
| Identifiers: User ID | No | No | App Functionality | RevenueCat's anonymous id |
| Contact Info: Name, Email Address, Phone Number | Yes | No | App Functionality | optional backup to the user's own Drive |
| Financial Info: Other Financial Info | Yes | No | App Functionality | fee records in that backup |
| User Content: Other User Content | Yes | No | App Functionality | notes, lessons, attendance in that backup |
| Identifiers: Device ID | Yes | No | App Functionality | Google Sign-In SDK's privacy manifest |
| Location: Coarse Location | Yes | No | App Functionality | Google Sign-In SDK's privacy manifest |
| Usage Data: Other Usage Data | Yes | No | App Functionality | Google Sign-In SDK's privacy manifest |

The studio can't read the Drive backups. They are declared anyway because they leave the device
through Google, and over-declaring is safe where under-declaring is what Apple rejects. The last
three rows and the name and email come from the privacy manifest shipped in the Google Sign-In SDK
(`ios/Pods/GoogleSignIn/GoogleSignIn/Sources/Resources/PrivacyInfo.xcprivacy`), and apply only to
people who choose to sign in.

## Age rating questionnaire

All "None" / "No", including the social media questions (no feeds or user-generated content
shared between users) and unrestricted web access. Result: 4+. Mark "Made for Kids" off.

## Pricing and availability

- Base price: Free.
- Availability: all territories except the 27 EU storefronts. The account's Digital Services Act
  declaration is "not a trader" (see Odova's 2026-11-04 decision); to add the EU, change it to
  trader, which publishes a verified phone, email and address on the EU listing.
- Release: manual release after approval, so the announcement goes out at the same time.

## Export compliance and other questions

- Encryption: only exempt HTTPS (`usesNonExemptEncryption: false` is already in `app.json`).
- Advertising Identifier (IDFA): No.
- Content rights: no third-party content.

## Screenshots

iPhone 6.9" (1320x2868) in `store/screenshots/ios-6.9/` and 6.3" (1206x2622) in
`store/screenshots/ios-6.3/`, eight panels in the upload order 01 to 08. Same headlines as the
Google Play set. No iPad set: the app is iPhone-only for the first release.

Regenerate them any time:

1. Build for the iPhone 17 Pro Max simulator and copy in the demo database
   (`node store/seed_demo.mjs <file>`, see `store/README.md`).
2. Set a clean status bar:
   `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100`
3. Capture into `store/source-ios/` with `xcrun simctl io booted screenshot <file>`, under the
   names `today`, `schedule`, `attendance`, `student`, `fees`, `plan`, `students` and `settings`.
4. Run `python3 store/build_screenshots_ios.py`.
