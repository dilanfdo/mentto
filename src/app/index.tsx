import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useSettings } from '@/db/settings';

/** Entry point: first launch goes to onboarding, otherwise straight to Today. */
export default function Index() {
  const { data: settings } = useSettings();

  useEffect(() => {
    if (settings) SplashScreen.hideAsync().catch(() => {});
  }, [settings]);

  if (!settings) return null;
  return <Redirect href={settings.onboarded ? '/today' : '/onboarding'} />;
}
