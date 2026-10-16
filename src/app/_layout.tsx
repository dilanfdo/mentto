import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { BackupSync } from '@/backup/BackupSync';
import { SnackbarProvider } from '@/components/ui';
import { DATABASE_NAME, migrateDatabase } from '@/db/schema';
import { ReminderSync } from '@/notifications/ReminderSync';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <SnackbarProvider>
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
          <Stack.Screen name="student/[id]/slot" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="student/[id]/plan" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="student/[id]/payment" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="backup" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style="auto" />
      </SnackbarProvider>
    </SQLiteProvider>
  );
}
