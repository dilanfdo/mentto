# Launching Mentto on Google Play

Step-by-step runbook for getting Mentto from this repo onto Google Play, with Mentto Pro billing through
RevenueCat and Google Drive backup working for Play installs. Follow the parts in order: each one
unblocks the next (for example, Play won't let you create subscriptions until a build is uploaded, and
RevenueCat can't import products until they exist).

Who does what: **[repo]** steps are code changes in this repository; **[you]** steps happen in Play
Console, RevenueCat or Google Cloud, signed in as the NexusDigitalLabs studio accounts. Never use a
personal or letsbridge account for any of these.

| Part | What | Who | Time |
|---|---|---|---|
| 0 | Release prep in the repo | repo | 1 hour |
| 1 | Upload (signing) key | you | 10 min |
| 2 | Create the app in Play Console | you | 20 min |
| 3 | RevenueCat project and API key | you | 15 min |
| 4 | Build and upload the first AAB to Internal testing | you + repo | 30 min |
| 5 | Create the Pro products in Play | you | 30 min |
| 6 | Connect RevenueCat to Play; entitlement and offering | you | 30 min (+ up to 36 h to validate) |
| 7 | Google Cloud: OAuth for Play installs; publish consent screen | you | 15 min |
| 8 | Test on a real phone from Play (purchases, backup, reminders) | you | 1 hour |
| 9 | Store listing, graphics, content declarations, Data safety | you | 1–2 hours |
| 10 | Closed testing (if your account needs it) and production | you | 14+ days if required |

---

## Part 0 — Release prep in the repo [repo] ✅ done (2026-10-19)

- **Release signing:** `plugins/withReleaseSigning.js` reads the upload key from
  `~/.mentto-signing/keystore.properties` (or `$MENTTO_SIGNING_FILE`). Until Part 1 is done, release
  builds fall back to the debug key — fine for testing, not uploadable.
- **Version:** `app.json` → `expo.version` `1.0.0`, `expo.android.versionCode` `1`. Bump `versionCode`
  for every upload.
- **Minified release:** `expo-build-properties` with R8 minify and resource shrinking. Verified: the
  minified release runs normally on an emulator (data, Pro screen, PDFs, reminders).
- **Permissions:** `android.blockedPermissions` removes `SYSTEM_ALERT_WINDOW` (Expo's template adds it for
  the development menu overlay) and the legacy storage permissions; none are used. Reminders don't need
  `SYSTEM_ALERT_WINDOW`: they use `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` and
  `RECEIVE_BOOT_COMPLETED`. Verified on the minified release: a lesson reminder posted 6 seconds after
  its time, with sound.
- **Native dialog colours:** `plugins/withAccentColor.js` sets the Android accent to Mentto's indigo, so
  the date and time pickers no longer show Android's default teal.
- **Privacy policy:** `https://nexusdigitallabs.dev/mentto/privacy-policy/` (website repo), linked from
  Settings → About and from the Google Drive sign-in screen.
- **Store screenshot 8** is now "Reminders your way" (backup is Pro).
- **Checks:** `npx tsc --noEmit`, `npx expo lint`, `npm test` (27 tests), `npx expo-doctor` (21/21).

---

## Part 1 — Create the upload key [you] ✅ done (2026-10-19)

Created: `~/.mentto-signing/mentto-upload-key.jks` (PKCS12, alias `mentto-upload`, RSA 4096, owner
`CN=NexusDigitalLabs, OU=Mentto, O=NexusDigitalLabs, C=LK`, valid until 9999-12-31) with
`~/.mentto-signing/keystore.properties`. Verified: `bundleRelease` signs the AAB with it.

| Fingerprint | Value |
|---|---|
| Upload key SHA-1 | `0D:69:4D:05:18:D5:2D:FD:4C:86:45:6D:F5:3D:A1:34:14:7D:9F:31` |
| Upload key SHA-256 | `6B:F7:18:4E:5F:F3:45:BC:0F:0C:96:77:40:F8:40:4D:60:4E:A2:C2:F7:E4:DD:74:DC:97:B9:96:02:29:3A:FE` |

The password is only in `keystore.properties` and the backup (password manager + offline copy).

How it was made, for reference:

The upload key signs the files you upload. Google then re-signs the app with its own **app signing key**
for users (Play App Signing), so if the upload key is ever lost, Play Console can reset it.

```bash
mkdir -p ~/.mentto-signing
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/.mentto-signing/mentto-upload-key.jks \
  -alias mentto-upload -keyalg RSA -keysize 2048 -validity 36500
```

Use a strong password and these details: name `NexusDigitalLabs`, organisation `NexusDigitalLabs`,
country code `LK` (no personal name). Then create `~/.mentto-signing/keystore.properties`:

```properties
storeFile=/Users/<you>/.mentto-signing/mentto-upload-key.jks
storePassword=<password>
keyAlias=mentto-upload
keyPassword=<password>
```

Note the **upload key SHA-1** (needed in Part 7):

```bash
keytool -list -v -keystore ~/.mentto-signing/mentto-upload-key.jks -alias mentto-upload | grep SHA1
```

**Back up now:** copy the `.jks` and the passwords into your password manager and an offline drive.
Never commit them (the repo ignores `*.jks`).

---

## Part 2 — Create the app in Play Console [you]

Play Console → **Home → Create app** (signed in as the NexusDigitalLabs developer account).

| Field | Value |
|---|---|
| App name | `Mentto: Tutor Lessons & Fees` (28 of 30 characters; can change any time without a new build) |
| Default language | English (United States) — add English (UK) later if you like |
| App or game | **App** |
| Free or paid | **Free** (in-app purchases are still allowed; a free app can never become paid) |
| Declarations | Tick the Developer Program Policies and US export laws boxes |

Then, before any upload:

1. **Setup → App signing**: leave **Play App Signing** on (default, "Releases signed by Google Play").
2. **Monetize → Payments profile**: make sure the NexusDigitalLabs payments profile (the one Odova uses) is
   linked, with tax and bank details complete. Without it you can't create paid products.
3. **Settings → License testing**: add the Gmail accounts that will test purchases (yours and the
   coach's). License testers are never charged, and subscriptions renew quickly for testing
   (a monthly plan renews every 5 minutes).
4. **Testing → Internal testing → Testers**: create an email list ("Mentto team") with the same Gmail
   accounts and save. Copy the **opt-in link** shown there.

---

## Part 3 — RevenueCat project and API key [you] ✅ done (2026-10-19)

- RevenueCat project **Mentto** (platform: React Native) with a **Google Play** app configuration
  `Mentto (Android)`, package `app.nexusdigitallabs.mentto`. Service account JSON comes in Part 6.
- The onboarding wizard's suggested entitlement and placeholder products were **skipped**; the
  entitlement (`pro`), products and offering are created in Part 6 from the real Play products.
- Ignore the **Test Store** key (`test_…`); Mentto uses the Google Play public key (`goog_…`).

### Debug vs production setup (same pattern as Odova and Huffle)

`src/lib/config.ts` reads `EXPO_PUBLIC_*` variables with safe defaults; `.env.example` documents them;
`.env.local` (git-ignored) holds local overrides.

| | Debug build (`npm run android`) | Release build (`gradlew bundleRelease`) |
|---|---|---|
| Pro purchases | Simulated (no store, nothing charged) | Google Play through RevenueCat |
| RevenueCat key | Built-in default (`goog_…`, public) | Built-in default |
| Signing | Debug key | Upload key from `~/.mentto-signing` |

To try real Google Play billing from a debug build, set `EXPO_PUBLIC_BILLING_MODE=store` in
`.env.local` (the app must already be on the Internal testing track, and the phone signed in with a
license tester account). Never put a RevenueCat secret key (`sk_…`) in any `EXPO_PUBLIC_` variable.

---

## Part 4 — Build and upload the first AAB [you + repo] (build ✅ 2026-10-19; upload: you)

Built and verified 1.0.0 (code 1): signed with the upload key (SHA-1 `0D:69:…:9F:31`), no
`AD_ID`/`SYSTEM_ALERT_WINDOW`/storage permissions, RevenueCat key present, real-billing mode confirmed on
an emulator. Files: `~/Desktop/Mentto-Releases/1.0.0-code1/` (`mentto-1.0.0-code1.aab` to upload, the
APK for sideloading, `SHA256SUMS.txt`, `release-notes.txt`).

Build steps, for every later release:

```bash
cd mentto
npx tsc --noEmit && npm test
pkill -f GradleDaemon 2>/dev/null
rm -rf android
npx expo prebuild --platform android --no-install
(cd android && ./gradlew bundleRelease assembleRelease)
```

- Upload this: `android/app/build/outputs/bundle/release/app-release.aab`
- Sideload/test this: `android/app/build/outputs/apk/release/app-release.apk`

**Verify before uploading** (same checks as Huffle's `docs/RELEASING.md` §6):

```bash
BT=$ANDROID_HOME/build-tools/37.0.0
APK=android/app/build/outputs/apk/release/app-release.apk
AAB=android/app/build/outputs/bundle/release/app-release.aab
$BT/aapt2 dump badging $APK | grep -E "^package|application-debuggable"   # versionCode 1; no debuggable line
keytool -printcert -jarfile $AAB | grep SHA1                                # must be the upload key from Part 1
$BT/aapt2 dump permissions $APK | grep -iE "AD_ID|SYSTEM_ALERT_WINDOW|EXTERNAL_STORAGE"   # must print nothing
unzip -p $APK assets/index.android.bundle | grep -a -c "goog_"              # must be 1 (RevenueCat key baked in)
```

If you change `.env.local` after a build and Gradle reports the bundle task `UP-TO-DATE`, force the JS to
rebuild: `(cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun)`.

Copy both files to `~/Desktop/Mentto-Releases/1.0.0-code1/` with a `release-notes.txt`.

**Upload:** Play Console → **Test and release → Testing → Internal testing → Create new release** →
upload the AAB → release name `1.0.0 (1)` → notes:

```
<en-US>
First release of Mentto: students, weekly and one-off lessons, group classes, attendance, fees and reminders.
</en-US>
```

→ **Next → Save and publish** (internal testing needs no review). Testers open the opt-in link from
Part 2, accept, then install from the Play Store link on that page.

Then note the **Play app signing key SHA-1**: **Test and release → App integrity → App signing →
App signing key certificate → SHA-1**. You need it in Part 7.

---

## Part 5 — Create the Pro products in Play [you] ✅ done (2026-10-19)

These IDs must match exactly; RevenueCat and the app look for them.

### 5a. Subscription `mentto_pro` (monthly and yearly)

**Monetize with Play → Products → Subscriptions → Create subscription**

- Product ID: `mentto_pro` (permanent) · Name: `Mentto Pro`
- Benefits (shown on Google's subscription screen, up to 4): `Unlimited students and groups`,
  `Automatic Google Drive backup`, `Income reports and PDF receipts`, `Your own message templates`

**Add base plan → Auto-renewing:**

| Base plan ID | Billing period | Grace period | Resubscribe | Price (set in USD; Google converted the rest, LKR included) |
|---|---|---|---|---|
| `monthly` | 1 month | 7 days | Allow | USD 3.99 |
| `yearly` | 1 year | 14 days | Allow | USD 29.99 |

Every other country (Sri Lanka included) uses Google's local conversion of the USD price. Prices can be
changed later per country without touching the app; existing subscribers keep their price unless you
move them. **Activate** each base plan.

**Add offer** on each base plan (the 7-day free trial):

- Offer ID: `trial-7d` · Eligibility: **New customer acquisition → Never had this subscription**
- Phases: **Free trial**, duration **7 days**
- Tags: `trial` · **Activate**

### 5b. One-time product `mentto_pro_lifetime`

**Monetize with Play → Products → In-app products → Create product** (Google now calls these
"one-time products"):

- Product ID: `mentto_pro_lifetime` · Name: `Mentto Pro (lifetime)`
- Description: `All Pro features, paid once.`
- Purchase option ID: `lifetime` · Purchase type: **Buy**
- Price: USD 59.99, other countries converted by Google → **Activate**
- Tax category: **Digital app sales** (as for Odova)

---

## Part 6 — Connect RevenueCat to Play; entitlement and offering [you] ✅ done (2026-10-20)

Status: service account `revenuecat@mentto-511807.iam.gserviceaccount.com` uploaded; catalog checks
valid (all three checks green); products imported (lifetime as non-consumable), entitlement `pro`,
offering `default` (current) with three packages; real-time notifications connected via topic
`projects/mentto-511807/topics/Play-Store-Notifications` (test received).

### 6a. Service account (lets RevenueCat check purchases with Google)

In Google Cloud, project **Mentto** (the one that already holds the Drive backup OAuth client):

1. **APIs & Services → Library**: enable **Google Play Android Developer API** and
   **Google Play Developer Reporting API**.
2. **IAM & Admin → Service accounts → Create**: name `revenuecat`, roles **Pub/Sub Admin** and
   **Monitoring Viewer** (needed for real-time notifications; add later via **IAM → Grant access**).
3. Open it → **Keys → Add key → JSON** → download (keep it private; don't commit it).

In Play Console → **Users and permissions → Invite new users**:

- Email: the service account's address (`revenuecat@mentto-511807.iam.gserviceaccount.com`)
- **App permissions → Add app → Mentto**, and tick:
  **View app information and download bulk reports**, **View financial data, orders, and cancellation
  survey responses**, and **Manage orders and subscriptions**. (Odova's lesson: missing either the
  financial or the orders permission makes validation fail silently.)
- **Invite user**.

In RevenueCat → **Mentto (Android) app settings → Service account credentials JSON**: upload the JSON.
The status can take up to **36 hours** to turn green ("Valid credentials"). You can continue meanwhile.

Also in the app settings, under **Google developer notifications**, follow RevenueCat's prompt to connect
the Pub/Sub topic (enable the **Cloud Pub/Sub API** first), then paste the topic name into Play Console →
**Monetization setup → Real-time developer notifications** and send a test notification.

### 6b. Products, entitlement and offering

RevenueCat → **Product catalog**:

1. **Products → Import** → select `mentto_pro:monthly`, `mentto_pro:yearly` and `mentto_pro_lifetime`
   (set the lifetime type to **Non-consumable**, so it restores after a reinstall).
2. **Entitlements → New** → identifier **`pro`** (must be exactly this) → description `Mentto Pro` →
   **Attach** all three products.
3. **Offerings → New** → identifier `default`, description `Monthly, yearly and lifetime` → add packages:

   | Package | Product |
   |---|---|
   | `$rc_annual` (Annual) | `mentto_pro:yearly` |
   | `$rc_monthly` (Monthly) | `mentto_pro:monthly` |
   | `$rc_lifetime` (Lifetime) | `mentto_pro_lifetime` |

   → **Make current** (the app reads the current offering).

The app shows yearly first (badged "Best value"), then monthly, then lifetime; prices and the free trial
come from Play, so nothing in the app needs changing when you adjust prices.

---

## Part 7 — Google Cloud: Drive backup for Play installs [you]

Drive sign-in works only when the installed app's signing SHA-1 has its own Android OAuth client.
Today the project has a client for the **debug** key only.

Google Cloud → project **Mentto** → **Google Auth Platform (APIs & Services → Credentials)**:

1. **Create credentials → OAuth client ID → Android** — name `Mentto Android (Play)`, package
   `app.nexusdigitallabs.mentto`, SHA-1 = **Play app signing key** from Part 4.
2. Again for `Mentto Android (upload)` with the **upload key** SHA-1 from Part 1 (for sideloaded
   release APKs).
3. **Branding**: app name `Mentto`, support email `hello@nexusdigitallabs.dev`, app logo
   `store/icon-512.png` (optional), home page `https://nexusdigitallabs.dev/mentto/`, privacy policy
   `https://nexusdigitallabs.dev/mentto/privacy-policy/`, authorized domain `nexusdigitallabs.dev`.
4. **Audience → Publish app** (from Testing to **In production**). `drive.appdata` is a non-sensitive
   scope, so no Google verification is needed — but until you publish, only listed test users can sign in.

No new build is needed: Google matches clients by package name + SHA-1. Changes can take a few minutes
to an hour.

| Symptom | Cause |
|---|---|
| Sign-in fails at once (error 10, `DEVELOPER_ERROR`) | No Android client for the installed build's SHA-1 |
| "Access blocked" / "only test users" | Consent screen still in Testing |
| Works sideloaded, fails from Play | Only the upload key has a client, not the Play app signing key |

---

## Part 8 — Test on a real phone from Play [you]

Install from the **internal testing** link on a phone signed in with a **license tester** account
(uninstall the development build first; the two can't share the same package).

- [ ] Onboarding, add students, slots, a group, fees and payments work as before.
- [ ] **Pro screen shows real prices** from Play (LKR on a Sri Lankan account) and the 7-day trial.
- [ ] **Buy monthly** with the test card "Test card, always approves" → "Welcome to Mentto Pro";
      the 9th student, a 2nd group, reports, PDFs and templates unlock.
- [ ] RevenueCat → **Customers** shows the purchase and the `pro` entitlement as active.
- [ ] **Restore purchases** on a second test phone with the same Google account unlocks Pro.
- [ ] Let the test subscription lapse (cancel it in Play → Subscriptions; test renewals are minutes long)
      → Pro ends, existing students and records stay, auto-backup pauses.
- [ ] **Lifetime**: buy with a second tester account → Pro unlocks permanently.
- [ ] **Drive backup** (on Pro): Settings → Backup → sign in → "Backed up". Reinstall → Restore from
      Google Drive brings everything back.
- [ ] **Reminders**: allow notifications and "Alarms & reminders"; a lesson reminder arrives on time,
      with sound, while the app is closed.
- [ ] Settings → Privacy policy opens the page.

---

## Part 9 — Store listing and declarations [you]

### 9a. Main store listing (Grow users → Store presence → Main store listing)

| Field | Value |
|---|---|
| App name | `Mentto: Tutor Lessons & Fees` |
| Short description (80) | `Students, lessons, attendance and fees for tutors and coaches, in one place.` |
| App icon | `store/icon-512.png` |
| Feature graphic | `store/feature-graphic-1024x500.png` |
| Phone screenshots | `store/screenshots/phone/01…08` |
| 7-inch tablet | `store/screenshots/tablet-7in/01…08` |
| 10-inch tablet | `store/screenshots/tablet-10in/01…08` |
| Video (optional) | Upload `store/video/mentto-demo.mp4` to the studio's YouTube channel as unlisted, paste the URL |

**Full description (4000 max):**

```
Mentto is the planner for independent tutors, music teachers and coaches. Your students, lessons, attendance and fees in one place, with a reminder before every class and every due date.

YOUR TEACHING DAY AT A GLANCE
• Today shows your lessons, who's coming and who owes fees.
• Mark attendance in a tap, or mark a whole group class at once.

LESSONS THAT RUN THEMSELVES
• Set a weekly slot once; it repeats every week or every other week.
• Book extra one-off lessons any time.
• Move or cancel a single lesson without touching the rest.
• Group classes: one class, every student, attendance for each.

FEES THAT ADD UP
• Monthly, per-term or per-lesson fees.
• Record payments by cash, bank transfer or card.
• See who's overdue, who's due today and what's coming up.
• Send a polite reminder or a receipt through WhatsApp, SMS or email.

REMINDERS
• A heads-up before each lesson, and on the morning a fee falls due.

PRIVATE BY DESIGN
• No account needed. Your students' details stay on your phone.
• Export your records to a spreadsheet any time.

MENTTO PRO
Free covers up to 8 students and 1 group. Pro adds:
• Unlimited students and groups
• Automatic backup to your own Google Drive
• Income reports: by month, by student and by payment method
• PDF receipts and monthly statements
• Your own wording for reminders and receipts
Try Pro free for 7 days, then monthly or yearly, or pay once for lifetime. Cancel any time in Google Play. If Pro ends, nothing is locked or deleted.
```

### 9b. Store settings

- **Category:** Business · **Tags:** Productivity, Business, Education, Calendar, Organizers
- **Contact:** email `hello@nexusdigitallabs.dev`, website `https://nexusdigitallabs.dev/mentto/`

### 9c. App content (Policy and programs → App content)

| Item | Answer | Why |
|---|---|---|
| Privacy policy | `https://nexusdigitallabs.dev/mentto/privacy-policy/` | Required; also linked in Settings |
| App access | **All functionality is available without special access** | No login wall; Pro can be tested with license testers |
| Ads | **No, my app does not contain ads** | No ad SDKs |
| Advertising ID | **No** | No ad, analytics or attribution SDKs; confirm `AD_ID` is absent (Part 4) |
| Content rating | Category **All other app types**; answer **No** to everything → Everyone / PEGI 3 | No user-to-user features, no shared location, no gambling. Digital purchases: **Yes** (Pro) |
| Target audience | **18 and over** only | It's a tool for tutors running a business. Not designed for children |
| News app | No | |
| Government app | No | |
| Financial features | **My app doesn't provide any financial features** | It records fees; it doesn't move, lend or hold money |
| Health | No health features | |
| Account creation / deletion | "My app does not allow users to create an account" | Login with outside accounts: **Yes → Other**: "Tutors may optionally sign in with their Google account only to back up and restore their records to their own Google Drive. Mentto does not create or manage accounts." |
| Data deletion URL | the privacy policy URL | Uninstall or clear storage removes local data; backups live in the user's own Drive |

### 9d. Data safety

- **Does your app collect or share any of the required user data types?** **Yes** (Drive backup and
  Play billing via RevenueCat send data off the device).
- **Is all data encrypted in transit?** **Yes** · **Can users request deletion?** **Yes** (policy URL).

| Data type | Collected | Shared | Optional | Purpose | Why |
|---|---|---|---|---|---|
| Personal info → Name, Email address, Phone number | Yes | No | Yes | App functionality | Student contact details, included in the optional backup to the user's own Drive |
| Financial info → Other financial info | Yes | No | Yes | App functionality | Fee and payment records, in the optional backup |
| App activity → Other user-generated content | Yes | No | Yes | App functionality | Notes, lessons and attendance, in the optional backup |
| Financial info → Purchase history | Yes | No | No (only if buying Pro) | App functionality | RevenueCat records Pro purchases to unlock them |
| Device or other IDs | Yes | No | No | App functionality | RevenueCat's anonymous app user ID for restoring purchases |

"Processed ephemerally": **No** for all. Service providers (RevenueCat, Google) don't count as sharing.

### 9e. Countries

**Test and release → Production → Countries/regions:** add all (or start with Sri Lanka, India, UK,
Australia, US, Canada, Singapore, UAE, New Zealand, matching the currencies in onboarding).

---

## Part 10 — Closed testing and production [you]

**If the developer account is a personal account created after 13 Nov 2023**, Google requires a
**closed test with at least 12 testers opted in for 14 consecutive days** before you can apply for
production. Organisation accounts are exempt. (Play Console shows the requirement on the Dashboard if it
applies.) If it does:

1. **Testing → Closed testing → Create track** "Pilot" → testers: a Google Group or email list of 12+
   people (tutors you know, the vocal coach, friends with Android phones) → promote the internal release
   to it → **Send for review**.
2. Keep 12+ testers opted in for 14 days; ask them to open the app a few times.
3. **Dashboard → Apply for production** and answer the questions about the test.

**Production release:** **Production → Create new release** → **Add from library** (the tested AAB) →
release notes → **Review release → Start rollout to production** (staged rollout 20% → 100% is a good
habit). First reviews usually take a few days; later updates are faster.

After launch:

- [ ] Install from the public Play listing and repeat the purchase and Drive backup checks with a
      non-tester account (Play app signing key path, consent screen in production).
- [ ] Watch **Android vitals** and the **pre-launch report** for crashes and recommendations.
- [ ] Watch RevenueCat → **Overview** for trials, conversions and renewals.
- [ ] Set `PLAY_URL` in the website's `src/app/mentto/page.tsx` so the "Coming soon" pill becomes the
      Google Play badge.

## Every later release

1. Bump `expo.android.versionCode` (and `expo.version` for user-visible changes) in `app.json`.
2. Part 4 build and checks → upload to Internal testing → test → promote to Production.
3. Keep release files and notes in `~/Desktop/Mentto-Releases/<version>-code<N>/`.
