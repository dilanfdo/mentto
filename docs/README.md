# Mentto documentation

Mentto is an offline-first planner for independent tutors, on Android and iPhone. There is no Mentto
server: records live in SQLite on the device, and the only network services are the app stores,
RevenueCat and the tutor's own Google Drive.

## Technical reference

| Document | Covers |
|---|---|
| [architecture.md](./architecture.md) | How the app is built: layers, database, lessons and fees, reminders, backup, billing, UI, testing |
| [platforms.md](./platforms.md) | How the Android and iOS apps are set up, built, signed and versioned, and where they differ |
| [integrations.md](./integrations.md) | Every outside service and account: what it does, how it's connected, what breaks without it |

## Release runbooks

| Document | Covers |
|---|---|
| [PLAY_STORE.md](./PLAY_STORE.md) | Google Play launch, step by step, and every later Android release |
| [ios-release.md](./ios-release.md) | App Store setup and every iOS release |
| [ios-app-store-listing.md](./ios-app-store-listing.md) | Paste-ready App Store text, products and privacy answers |
| [../store/README.md](../store/README.md) | Icons, screenshots and how to regenerate them |

Rules for working in the code are in [../AGENTS.md](../AGENTS.md).

## Where things stand (2026-11-04)

- **Android:** live on Google Play as 1.0.0 (versionCode 2).
- **iOS:** 1.0.0 (build 1) is uploaded to TestFlight and not yet submitted to App Review. Products,
  RevenueCat and the Google client are set up, and the listing is being filled in. Real sandbox purchases, Google sign-in,
  restoring an Android backup and reminder delivery still need checking on an iPhone
  ([checklist](./ios-release.md#6-test-on-testflight-before-submitting)).
- **Shared code:** the Android build on Play predates the iOS work (commit `a97e283`). That commit also
  changes shared code, so the next Android release needs its usual test pass.
