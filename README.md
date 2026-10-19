# Mentto

A planner for independent tutors and coaches: enroll students, keep their details, set fee plans,
book recurring time slots, track attendance and payments, and get reminders before classes and fee
due dates. The first version is for the tutor only; a student-facing side comes later with a backend.

## Stack

- Expo SDK 57, React Native, TypeScript, Expo Router (`src/app/`)
- `expo-sqlite` for all app data, stored on the device (`src/db/schema.ts`)
- `expo-notifications` for local reminders
- Backup: automatic upload to the tutor's Google Drive `appDataFolder` (planned), with Android Auto Backup as a fallback
- Plus Jakarta Sans (SIL Open Font License), bundled in `assets/fonts`

## Develop

```bash
npm install
npm run android   # builds and runs a development build on a device or emulator
npm run typecheck
npm run lint
```

Native modules (SQLite, notifications, Google Sign-In, billing) need a development build, not Expo Go.

Configuration lives in `src/lib/config.ts`; copy `.env.example` to `.env.local` for overrides. Debug
builds simulate Pro purchases; release builds use Google Play billing through RevenueCat. Releasing to
Google Play: `docs/PLAY_STORE.md`.

App ID: `app.nexusdigitallabs.mentto`
