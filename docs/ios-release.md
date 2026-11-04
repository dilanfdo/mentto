# iOS release checklist

Status (2026-11-04): build 1 is on TestFlight. Testing, finishing the listing and submission are next. Listing text is in [ios-app-store-listing.md](./ios-app-store-listing.md).

**Use only the personal Apple ID (`dilanfdo1@gmail.com`, team `S3NGY3A2RA`). Never the LetsBridge
account, team or certificates.** Simulator builds disable code signing, so no certificate is touched.

## Code and config (done)

- iPhone-only for the first release (`supportsTablet: false`), as with Odova. iPad can be added later;
  removing it from a shipped app can't be done cleanly.
- `app.config.js` extends `app.json`: pins `APPLE_TEAM_ID`, adds the Google URL scheme, and refuses a
  release build without both.
- "Move this lesson" works on iOS, inside the lesson sheet (Android keeps its picker dialogs).
- The paywall shows Apple's free trial only to accounts still eligible for it, the auto-renewal terms,
  Terms of Use and Privacy Policy links, and iOS-specific store wording.
- Stat tiles scale long amounts by length on iOS, where native fit-to-width collapses the text.
- Rows dim when pressed on iOS, where there is no ripple. Device name in backups is iPhone or iPad.
- No Sign in with Apple needed: Google sign-in is only for the user's own Drive, not an app login.

## 1. App Store Connect

1. **Business** (Agreements, Tax and Banking): already done for Odova if the Paid Apps agreement,
   tax forms and bank are active. No repeat needed.
2. **Certificates, Identifiers & Profiles** (developer.apple.com): register
   `app.nexusdigitallabs.mentto` as an explicit App ID. App Store Connect only offers registered IDs.
3. **Apps, +, New App**: iOS, the name, bundle ID, SKU and language from the listing doc.
4. **Monetization**: create the subscription group, both subscriptions and the Lifetime purchase, with
   the table in the listing doc. Add a localization to the group, and put Yearly at level 1. Upload
   `store/ios-review/paywall.png` as each review screenshot.
5. **Pricing and Availability**: set the app to **$0.00 (Free)**, and leave out the 27 EU countries.

## 2. RevenueCat (the Mentto project)

1. **Apps, + New, App Store**: bundle ID `app.nexusdigitallabs.mentto`.
2. **In-App Purchase key**: the team-wide key already made for Odova works, with the same issuer id
   (see where it's stored in the Files folder), or create a new one in App Store Connect, Users and
   Access, Integrations, In-App Purchase. Apple lets you download a key only once.
3. **Products**: add the three App Store products with **New product**. Import needs an App Store Connect
   API key that this setup doesn't use, so they show "Could not check", which is fine.
4. **Entitlements**: attach all three to `pro`.
5. **Offerings, `default`**: add the App Store product to each existing package: `$rc_monthly` →
   `mentto_pro_monthly`, `$rc_annual` → `mentto_pro_yearly`, `$rc_lifetime` → `mentto_pro_lifetime`.
6. Copy the public SDK key (`appl_...`) for section 4.
7. Copy the **Apple Server Notification URL** from the app's **Apple Server to Server notification
   settings** section in RevenueCat. Paste it into App Store Connect (App Information, App Store Server
   Notifications, production and sandbox).

## 3. Google Cloud (project `mentto-511807`)

**APIs & Services, Credentials, Create credentials, OAuth client ID**: type **iOS**, name
`Mentto iOS`, bundle ID `app.nexusdigitallabs.mentto`. Leave App Store ID blank. Copy the client ID
(`....apps.googleusercontent.com`) for section 4. The consent screen and `drive.appdata` scope are
already in production, and backups made on Android appear on iPhone because it's the same project.

## 4. Local settings

Create `.env.production.local` (gitignored):

```
APPLE_TEAM_ID=S3NGY3A2RA
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=....apps.googleusercontent.com
```

## 5. Local build and release from Xcode

No EAS. For every release:

```bash
# bump ios.buildNumber in app.json (and version when the user-facing version changes)
scripts/ios-release-prepare.sh        # regenerates ios/, checks the team and the keys
open ios/Mentto.xcworkspace
```

In Xcode: target Mentto, Signing & Capabilities, "Automatically manage signing", and confirm Team is
the personal paid team (it's pinned; Xcode also knows a free Personal Team and LetsBridge, so don't
pick those). Destination "Any iOS Device (arm64)", then Product, Archive. In the Organizer: Distribute
App, App Store Connect, Upload. The build appears in App Store Connect, TestFlight. Each upload needs
a new `buildNumber`.

## 6. Test on TestFlight before submitting

- Fresh install, onboarding, and the notification permission prompt.
- A lesson reminder arrives on time with the app closed. Move a lesson and check its reminder moves.
- Paywall: real prices and "7 days free" on the subscriptions. Sandbox purchase unlocks Pro, then
  check the purchase and the trial show in RevenueCat with the Sandbox data toggle on.
- Restore purchases, on a reinstall. Privacy Policy and Terms of Use links open.
- Google sign-in, Back up now, and restoring **a backup made on the Android phone**.
- PDF receipt, CSV export, the share sheet to WhatsApp, and the keyboard on each form.
- Dark mode, larger Dynamic Type, and a small phone (iPhone SE).

## 7. Submit

1. Fill in the version page from the listing doc, with screenshots, and attach the three purchases.
2. Answer App Privacy, age rating and the availability settings.
3. Choose **manual release**, then Add for Review.

## 8. After approval

- Press release in App Store Connect.
- Add the App Store badge and link to the website `/mentto/` page, replacing "iPhone · coming soon".
- Post on Facebook using `store/social/` with an App Store line added.
