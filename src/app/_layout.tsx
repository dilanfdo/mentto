import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { BackupSync } from '@/backup/BackupSync';
import { ProProvider } from '@/billing/ProProvider';
import { SnackbarProvider } from '@/components/ui';
import { DATABASE_NAME, migrateDatabase } from '@/db/schema';
import { ReminderSync } from '@/notifications/ReminderSync';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Development only: expo-router logs this when the dev client opens the app through its own deep
// link (expo-router/build/fork/useLinking). It isn't from Mentto's code and doesn't affect the app.
LogBox.ignoreLogs(["Can't perform a React state update on a component that hasn't mounted yet"]);

export default function RootLayout() {
  const { colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <SnackbarProvider>
        <ProProvider>
          <ReminderSync />
          <BackupSync />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="student/new" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="student/[id]/edit" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="slot" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="group/new" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="group/[id]/edit" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="student/[id]/plan" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="student/[id]/payment" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="backup" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="pro" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
          <StatusBar style="auto" />
        </ProProvider>
      </SnackbarProvider>
    </SQLiteProvider>
  );
}
