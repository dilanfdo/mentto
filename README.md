# Mentto

A planner for independent tutors and coaches: enroll students, keep their details, set fee plans,
book recurring time slots, track attendance and payments, and get reminders before classes and fee
due dates. It runs on Android and iPhone, with everything stored on the device and no Mentto server.

## Stack

- Expo SDK 57, React Native, TypeScript, Expo Router (`src/app/`)
- `expo-sqlite` for all app data, stored on the device (`src/db/schema.ts`)
- `expo-notifications` for local reminders
- Backup: automatic upload to the tutor's own Google Drive `appDataFolder` (Pro)
- Purchases: Google Play and the App Store through RevenueCat
- Plus Jakarta Sans (SIL Open Font License), bundled in `assets/fonts`

## Develop

```bash
npm install
npm run android   # builds and runs a development build on a device or emulator
npm run typecheck
npm run lint
npm test
```

Native modules (SQLite, notifications, Google Sign-In, billing) need a development build, not Expo Go.
For the iOS simulator, see [docs/platforms.md](docs/platforms.md#ios-builds).

Configuration lives in `src/lib/config.ts`; copy `.env.example` to `.env.local` for overrides. Debug
builds simulate Pro purchases, and release builds use the real store through RevenueCat.

## Documentation

Start at [docs/README.md](docs/README.md): architecture, Android and iOS setup, third-party integrations
and the release runbooks.

App ID: `app.nexusdigitallabs.mentto`
