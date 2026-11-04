# Architecture

How the app is built. For native setup see [platforms.md](./platforms.md); for outside services see
[integrations.md](./integrations.md).

## Overview

Mentto is one Expo / React Native codebase in TypeScript. It has no backend of its own, so there are no
Mentto accounts, no sync server and nothing to operate.

| Part | Technology |
|---|---|
| App framework | Expo SDK 57, React Native 0.86 (New Architecture, Hermes), React 19 |
| Navigation | Expo Router, file-based, in `src/app/` |
| Storage | `expo-sqlite`, one database, `mentto.db` |
| Reminders | `expo-notifications`, local only |
| Backup | Google Drive REST API, through `@react-native-google-signin/google-signin` |
| Purchases | `react-native-purchases` (RevenueCat) |
| Documents | `expo-print` for PDFs, `expo-sharing` and `expo-file-system` for sharing |

## Source layout

```
src/
  app/            routes: every file is a screen
    (tabs)/       Today, Students, Schedule, Fees
    student/      new, [id]/ page, edit, plan, payment
    group/        new, [id]/ page, edit
    slot          add or edit a weekly slot or one-off lesson
    onboarding, settings, backup, pro, reports, templates
  db/             SQL, one file per area; core.ts has write() and useQuery()
  domain/         derived data: lessons.ts, fees.ts (pure functions where possible)
  notifications/  reminder planner and its sync component
  backup/         Drive client, snapshots, retention, the engine
  billing/        RevenueCat wrapper, entitlement context, free limits
  components/     screen-level components; ui/ is the design system
  lib/            config, dates, money, recurrence, contact links, documents, templates
  theme/          design tokens
modules/exact-alarms/   local Expo module, Android only
plugins/                Expo config plugins
```

## App start

`src/app/_layout.tsx` nests the app-wide providers:

```
SQLiteProvider       opens mentto.db and runs migrations
  SnackbarProvider
    ProProvider      reads the Pro entitlement
      ReminderSync   keeps scheduled reminders in step with the data
      BackupSync     runs the Drive auto-backup
      Stack          the screens
```

`ReminderSync` and `BackupSync` render nothing. They subscribe to data changes and app state.
`src/app/index.tsx` sends the tutor to onboarding or the tabs, according to `meta.onboarded`.

## Database

The schema and migrations are in `src/db/schema.ts`. `PRAGMA user_version` holds the schema version, and
`SCHEMA_VERSION` is the number of migrations.

| Table | Holds |
|---|---|
| `students` | Name, contacts, guardian, notes, active or archived |
| `groups`, `group_members` | Group classes and who is in them |
| `fee_plans` | `monthly`, `term` or `per_session`, amount, currency, due day, period, dates |
| `schedules` | A weekly slot or one-off lesson, owned by one student **or** one group (enforced by `CHECK`) |
| `schedule_exceptions` | One date of a slot cancelled or moved |
| `sessions` | A lesson that was marked attended or missed, always per student, including in groups |
| `payments` | Amount, currency, date, method, note |
| `meta` | Key/value: settings, onboarding, backup bookkeeping, `change_seq` |

Rules that matter:

- **Migrations are append-only.** Never edit one that has shipped. Foreign keys are off while migrating,
  because rebuilding a table would otherwise cascade-delete its children, and each migration fails if
  `PRAGMA foreign_key_check` finds a broken reference.
- **Money is integer minor units** with a currency code, never a float (`src/lib/money.ts`).
- **Dates are local strings:** `YYYY-MM-DD`, `HH:MM` and `YYYY-MM-DDTHH:MM`, so a lesson stays at the same
  wall-clock time. Audit fields such as `created_at` are ISO timestamps.
- **IDs are random UUIDs** from `expo-crypto`.

### Writing and reading

All writes go through `write()` in `src/db/core.ts`. It runs the change in a transaction, bumps
`meta.change_seq`, and then notifies every subscriber. `useQuery()` re-runs after any write, so screens
never refresh by hand.

The app shares one connection, so transactions and backup snapshots go through the `exclusive()` queue
and never overlap. Backup bookkeeping and the simulated Pro flag are written to `meta` directly, outside
`write()`, so they don't mark the data as changed.

## Lessons

Slots aren't expanded into a row per future lesson. A slot stores an RFC 5545 RRULE subset
(`src/lib/recurrence.ts`):

```
FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE     every Monday and Wednesday
FREQ=WEEKLY;INTERVAL=2;BYDAY=TU        every other Tuesday
FREQ=ONCE                              one lesson on starts_on, with ends_on = starts_on
```

`src/domain/lessons.ts` builds the lessons for a date range from slots, exceptions and marked sessions.
One-off lessons use the same path, so moving, cancelling, attendance and reminders work the same for them.

## Fees

`src/domain/fees.ts` works out balances each time they're needed; none are stored.

- `chargesFor()` lists charges: one per period for `monthly` and `term` plans, and one per attended lesson
  for `per_session`.
- Balance is charges minus payments. Payments settle the oldest charge first, which gives "overdue since".
- Changing a plan only affects charges from its start date, so earlier charges keep their old price.

## Reminders

`src/notifications/reminders.ts` schedules local notifications. Nothing comes from a server.

- On launch, on return to the app and 1.5 seconds after any data change, it cancels everything and plans
  the next **14 days** again.
- It schedules at most **60**, the soonest first, because iOS allows 64 pending notifications.
- Lesson reminders go out `lesson_reminder_min` minutes before (default 30, 0 turns them off). Fee reminders
  go out at 09:00 on the due date, unless the fee is already paid in advance.
- On Android, reminders use the `lessons` and `fees` channels and need exact-alarm access to be on time
  (see [platforms.md](./platforms.md#reminders)).

**Known limit:** there is no background refresh. A tutor who doesn't open the app for over 14 days runs out
of scheduled reminders, and on a very busy timetable the 60 cap can shorten the window.

## Backup

Automatic backup to the tutor's own Google Drive is a Pro feature. Restoring is free. See
[integrations.md](./integrations.md#google-sign-in-and-drive) for the Google setup.

| File in `src/backup/` | Job |
|---|---|
| `account.ts` | Google sign-in and access tokens; shares one token request between callers |
| `drive.ts` | Minimal Drive v3 client, `appDataFolder` only |
| `snapshot.ts` | `VACUUM INTO` plus gzip, and restoring |
| `retention.ts` | Which old versions to delete |
| `engine.ts` | When to back up, state machine, conflicts |
| `BackupSync.tsx` | Connects the engine to data changes, app state and connectivity |

**When it runs:** 45 seconds after edits stop, when the app goes to the background, on return to the app and
when the connection comes back, but only if `change_seq` has moved past `last_backup_seq`. iOS and Android may
suspend the app before a background upload finishes, and the next return to the app retries it.

**What's uploaded:** a file named `mentto-<timestamp>.db.gz`. `appProperties` on the file hold the device ID and
name, `change_seq`, schema version and active student count, so the restore list can describe a version without
downloading it.

**What's kept:** the latest, the newest of each of the last 7 days, the newest of each of the last 4 weeks, and
the newest from every other device.

**Conflicts:** if the newest file in Drive came from another device and is newer than anything this device has
seen, the engine stops and the phase becomes `conflict`. The tutor either restores it or keeps this phone's data,
which records that file as acknowledged in `backup_ack_file`. Backup never overwrites or merges silently.

**Restoring:** `restoreSnapshot()` unpacks the file, runs `PRAGMA integrity_check`, refuses a backup from a newer
schema, and migrates an older one on a separate connection. It then replaces every table's rows in one
transaction on the live connection, so open screens just re-read. Install-specific `meta` keys
(`LOCAL_META_KEYS`) are kept. Snapshots are SQLite files with no platform-specific data, so one made on Android
should restore on iPhone and the other way round. That hasn't been tested on a real iPhone yet.

**Phases:** `off`, `signedOut`, `idle`, `pending`, `running`, `offline`, `error`, `conflict`.

## Billing

`src/billing/purchases.ts` wraps RevenueCat, `ProProvider.tsx` exposes `usePro()` and `openPaywall(feature)`, and
`src/app/pro.tsx` is the paywall.

| Build | `billingMode` | Behaviour |
|---|---|---|
| Debug | `simulated` | Fake plans; the flag is stored in `meta` and nothing is charged |
| Debug with `EXPO_PUBLIC_BILLING_MODE=store` | `store` | Real store |
| Release, with a key for the platform | `store` | Real store |
| Release, no key for the platform | `unavailable` | The paywall says Pro isn't available; Pro never unlocks for free |

- **Entitlement:** `pro`. The app only ever checks this.
- **Plans:** read from the current offering by package type, so prices and products can change without a build.
- **Free trial:** read from `defaultOption.freePhase` on Android and from `introPrice` on iOS. iOS also asks
  RevenueCat whether this Apple Account is still eligible, and an unknown answer shows no trial.
- **Identity:** RevenueCat's anonymous IDs. The app never calls `logIn`, and no name or email is sent.

**Known limit:** with anonymous IDs and no Mentto account, **Pro doesn't carry between Android and iPhone**. Someone
who buys on one needs to buy again on the other. Their records still move, because restoring a backup is free.

### Free and Pro

`FREE_LIMITS` in `src/billing/limits.ts` allows 8 active students and 1 active group. Pro adds unlimited students
and groups, automatic backup, income reports, PDF receipts and statements, and message templates. CSV export and
restoring are always free.

Limits only apply when adding. **When Pro ends, nothing is locked or deleted**; automatic backups pause, and
backups already in Drive can still be restored.

## Sharing and documents

- **Calls, SMS, email:** `src/lib/contact.ts` opens `tel:`, `sms:` and `mailto:` links.
- **Reminders and receipts:** text goes through the system share sheet, so WhatsApp or anything else works. Mentto
  has no integration with those apps and doesn't declare their URL schemes.
- **PDF and CSV:** `src/lib/documents.ts` creates the file on the device and hands it to the share sheet.

## UI

- Tokens are in `src/theme/tokens.ts`: light and dark colours, Plus Jakarta Sans type scale, 8-point spacing, radii
  and motion. Read them with `useTheme()`, which follows the system setting.
- Screens are built from `src/components/ui` (`Screen`, `Card`, `ListRow`, `Button`, `TextField`, `Sheet`, ...).
- Status is never shown by colour alone: badges carry an icon or words.

## Testing

```bash
npm test             # jest-expo
npm run typecheck
npm run lint
```

| Test file | Covers |
|---|---|
| `src/lib/__tests__/recurrence.test.ts` | Recurrence rules |
| `src/domain/__tests__/lessons.test.ts` | Lesson expansion, exceptions, attendance |
| `src/domain/__tests__/fees.test.ts` | Charges and balances |
| `src/lib/__tests__/pro.test.ts` | Free limits and message templates |
| `src/notifications/__tests__/reminders.test.ts` | The real planner against a real SQLite database (`node:sqlite`) |

Native code, purchases, Google sign-in and notification delivery aren't covered by these, so they're checked on
devices using the release checklists.
