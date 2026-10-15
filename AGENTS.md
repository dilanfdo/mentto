## Mentto

Mentto is an offline-first planner for independent tutors (students, fee plans, recurring slots,
attendance, payments, reminders). v1 is Android-first and tutor-only; there is no server.

- All data lives in SQLite. The schema and migrations are in `src/db/schema.ts`: append a new
  migration for any schema change and never edit one that has shipped.
- Store money as integer minor units (cents) with a currency code. Never use floats for amounts.
- Recurring slots are an RRULE plus `schedule_exceptions` overrides, not one row per future session.
- Every write should bump the change counter in `meta` so the auto-backup knows there is something to upload.
- Local notifications: iOS allows only 64 pending, so schedule a rolling window (about 14 days) and top it up.
- App ID is `app.nexusdigitallabs.mentto`. Never use a personal name or account for package IDs or ownership.

### Layout

- `src/app/` routes: `(tabs)/` Today, Students, Schedule, Fees; `student/[id]/` page plus edit, slot, plan
  and payment forms; `onboarding`, `settings`.
- `src/db/` data access (one file per area, plus `core.ts` with `write()` and `useQuery()`).
  `useQuery` re-runs automatically after any `write()`; always write through `write()`.
- `src/domain/` derived data: `lessons.ts` expands slots + exceptions + attendance into lessons,
  `fees.ts` turns plans, attendance and payments into balances (payments settle the oldest charge first).
- `src/notifications/` local reminders (rolling window, rescheduled on any data change).
- `modules/exact-alarms/` local Expo module: checks/opens Android's "Alarms & reminders" access, without
  which reminders can arrive up to an hour late.

### Design system

- Tokens live in `src/theme/tokens.ts` (colors for light and dark, Plus Jakarta Sans type scale, 8-pt
  spacing, radii, motion). Read them via `useTheme()`; never hard-code colors or font sizes in screens.
- Build screens from `src/components/ui` (`Screen`, `Card`, `ListRow`, `Button`, `TextField`, `Sheet`,
  `Badge`, `Chip`, `EmptyState`, `useSnackbar`...). Screens with a primary action put it in `Screen`'s
  `footer` (forms) or a `Fab` (lists).
- Status is never shown by color alone: badges carry an icon or words.
- Forms that edit loaded data split into a loader component and a body that seeds `useState` from props
  (no copying data into state inside effects; the React Compiler lint rules reject that).

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
