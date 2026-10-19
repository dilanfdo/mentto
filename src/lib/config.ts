// Build-time configuration, in one place. Values come from EXPO_PUBLIC_* environment variables
// (see .env.example; put local overrides in .env.local, which git ignores) with safe defaults, so a
// release build works without any local setup.
//
//                      debug build (npm run android)     release build (gradlew bundleRelease)
// Billing              simulated (no store, no charges)  Google Play through RevenueCat
// RevenueCat key       built-in default                  built-in default
//
// Set EXPO_PUBLIC_BILLING_MODE=store in .env.local to try real Google Play billing from a debug
// build (install the app from the Internal testing track once, and use a license tester account).

// RevenueCat public SDK keys. Like Odova's, these only identify the app to RevenueCat and are
// designed to ship inside it; they can't authorise anything on their own. Never put a secret
// (sk_…) key here or in any EXPO_PUBLIC_ variable: those are bundled into the app.
export const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || 'goog_gyMMfySHZJJNrzNCrFxlLKwGHnE';
export const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';

/** Must match the entitlement identifier in the RevenueCat dashboard. */
export const REVENUECAT_ENTITLEMENT_ID = 'pro';

export type BillingMode = 'store' | 'simulated';

const requested = process.env.EXPO_PUBLIC_BILLING_MODE;

/** Release builds always use the real store; debug builds simulate unless told otherwise. */
export const BILLING_MODE: BillingMode = !__DEV__ ? 'store' : requested === 'store' ? 'store' : 'simulated';
