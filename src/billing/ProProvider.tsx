import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { devResetSimulatedPro, initBilling, purchase, restore, subscribeToPro, type PurchaseResult } from './purchases';

export type ProFeature = 'students' | 'groups' | 'backup' | 'reports' | 'pdf' | 'templates';

type ProContext = {
  isPro: boolean;
  /** False until the entitlement has been read once. Gates should wait for it. */
  ready: boolean;
  buy: (planId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<{ ok: boolean; isPro: boolean }>;
  devReset: () => Promise<void>;
};

const Context = createContext<ProContext>({
  isPro: false,
  ready: false,
  buy: async () => ({ ok: false }),
  restorePurchases: async () => ({ ok: false, isPro: false }),
  devReset: async () => {},
});

export const usePro = () => useContext(Context);

/** Opens the Pro screen, highlighting what the tutor was trying to do. */
export function openPaywall(feature?: ProFeature) {
  router.push({ pathname: '/pro', params: feature ? { feature } : {} });
}

export function ProProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [isPro, setIsPro] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    initBilling(db).then((pro) => {
      if (!alive) return;
      setIsPro(pro);
      setReady(true);
    });
    const unsubscribe = subscribeToPro(setIsPro);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [db]);

  const buy = useCallback(async (planId: string) => {
    const result = await purchase(planId);
    if (result.ok) setIsPro(true);
    return result;
  }, []);

  const restorePurchases = useCallback(async () => {
    const result = await restore();
    if (result.ok) setIsPro(result.isPro);
    return result;
  }, []);

  const devReset = useCallback(async () => {
    await devResetSimulatedPro();
    setIsPro(false);
  }, []);

  const value = useMemo(
    () => ({ isPro, ready, buy, restorePurchases, devReset }),
    [isPro, ready, buy, restorePurchases, devReset],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
