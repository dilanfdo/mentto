// Mentto Pro: entitlement state and the purchase flow.
//
// Real billing goes through RevenueCat (Google Play / App Store) when an API key is configured.
// Without a key, development builds fall back to a local simulation so the paywall can be tested;
// release builds without a key never unlock Pro and show the plans as unavailable.
//
// To go live:
// 1. In Play Console create a subscription "mentto_pro" with two base plans, monthly and yearly
//    (add a 7-day free trial offer to each), and a one-time product "mentto_pro_lifetime".
// 2. In RevenueCat (NexusDigitalLabs account) create the project, connect Play, create the entitlement
//    `pro` and attach all three products, and make a "default" offering with the $rc_monthly,
//    $rc_annual and $rc_lifetime packages.
// 3. Set EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID (and _IOS later) when building. Nothing else changes.
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

import type { DB } from '@/db/core';

export const ENTITLEMENT_ID = 'pro';

const API_KEY =
  (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
    : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID) ?? '';

export type BillingMode = 'store' | 'simulated' | 'unavailable';

export const billingMode: BillingMode = API_KEY ? 'store' : __DEV__ ? 'simulated' : 'unavailable';

export type PlanKind = 'yearly' | 'monthly' | 'lifetime';

export type Plan = {
  id: string;
  kind: PlanKind;
  price: string;
  /** For the yearly plan: what it works out to per month. */
  perMonth: string | null;
  /** Days of free trial, when the store offers one to this user. */
  trialDays: number | null;
};

type Listener = (isPro: boolean) => void;

let configured: Promise<typeof import('react-native-purchases').default> | null = null;
function sdk() {
  configured ??= import('react-native-purchases').then((m) => {
    m.default.configure({ apiKey: API_KEY });
    return m.default;
  });
  return configured;
}

const isProIn = (info: CustomerInfo) => Boolean(info.entitlements.active[ENTITLEMENT_ID]);

// ── Simulation (development builds without a RevenueCat key) ─────────────────────

let simDb: DB | null = null;
const SIM_KEY = 'dev_simulated_pro';

async function simGet(): Promise<boolean> {
  const row = await simDb?.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', SIM_KEY);
  return row?.value === '1';
}

async function simSet(on: boolean): Promise<void> {
  // Written outside write(): billing state isn't user data and shouldn't trigger a backup.
  await simDb?.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    SIM_KEY,
    on ? '1' : '0',
  );
}

const SIM_PLANS: Plan[] = [
  { id: 'sim_yearly', kind: 'yearly', price: '$29.99', perMonth: '$2.50', trialDays: 7 },
  { id: 'sim_monthly', kind: 'monthly', price: '$3.99', perMonth: null, trialDays: 7 },
  { id: 'sim_lifetime', kind: 'lifetime', price: '$59.99', perMonth: null, trialDays: null },
];

// ── Public API ─────────────────────────────────────────────────────────────────

export async function initBilling(db: DB): Promise<boolean> {
  simDb = db;
  if (billingMode === 'simulated') return simGet();
  if (billingMode === 'unavailable') return false;
  try {
    return isProIn(await (await sdk()).getCustomerInfo());
  } catch {
    return false;
  }
}

/** Calls back when the entitlement changes (purchase, restore, renewal, expiry). */
export function subscribeToPro(listener: Listener): () => void {
  if (billingMode !== 'store') return () => {};
  let remove: (() => void) | null = null;
  let cancelled = false;
  sdk()
    .then((p) => {
      if (cancelled) return;
      const l = (info: CustomerInfo) => listener(isProIn(info));
      p.addCustomerInfoUpdateListener(l);
      remove = () => p.removeCustomerInfoUpdateListener(l);
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    remove?.();
  };
}

const KIND: Record<string, PlanKind | undefined> = { ANNUAL: 'yearly', MONTHLY: 'monthly', LIFETIME: 'lifetime' };

function trialDays(pkg: PurchasesPackage): number | null {
  const free = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (!free) return null;
  const perUnit = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 } as Record<string, number>;
  return free.value * (perUnit[free.unit] ?? 1);
}

let packages = new Map<string, PurchasesPackage>();

/** The plans to show on the paywall, best value first. Empty if the store has none right now. */
export async function loadPlans(): Promise<Plan[]> {
  if (billingMode === 'simulated') return SIM_PLANS;
  if (billingMode === 'unavailable') return [];
  try {
    const offering = (await (await sdk()).getOfferings()).current;
    const order: PlanKind[] = ['yearly', 'monthly', 'lifetime'];
    packages = new Map();
    const plans: Plan[] = [];
    for (const pkg of offering?.availablePackages ?? []) {
      const kind = KIND[pkg.packageType];
      if (!kind) continue;
      packages.set(pkg.identifier, pkg);
      plans.push({
        id: pkg.identifier,
        kind,
        price: pkg.product.priceString,
        perMonth: kind === 'yearly' ? pkg.product.pricePerMonthString : null,
        trialDays: trialDays(pkg),
      });
    }
    return plans.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  } catch {
    return [];
  }
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled?: boolean; error?: string };

export async function purchase(planId: string): Promise<PurchaseResult> {
  if (billingMode === 'simulated') {
    await simSet(true);
    return { ok: true };
  }
  const pkg = packages.get(planId);
  if (billingMode === 'unavailable' || !pkg) return { ok: false, error: 'Pro isn’t available right now.' };
  try {
    const { customerInfo } = await (await sdk()).purchasePackage(pkg);
    return isProIn(customerInfo) ? { ok: true } : { ok: false, error: 'The purchase didn’t complete.' };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: err.message ?? 'The purchase didn’t go through.' };
  }
}

export async function restore(): Promise<{ ok: boolean; isPro: boolean }> {
  if (billingMode === 'simulated') return { ok: true, isPro: await simGet() };
  if (billingMode === 'unavailable') return { ok: false, isPro: false };
  try {
    return { ok: true, isPro: isProIn(await (await sdk()).restorePurchases()) };
  } catch {
    return { ok: false, isPro: false };
  }
}

/** Development only: switch the simulated entitlement off again. */
export async function devResetSimulatedPro(): Promise<void> {
  if (billingMode === 'simulated') await simSet(false);
}
