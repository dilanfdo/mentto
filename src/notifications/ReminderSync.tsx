import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { subscribeToDataChanges } from '@/lib/events';

import { rescheduleReminders } from './reminders';

const DEBOUNCE_MS = 1500;

/** Keeps scheduled reminders in step with the data: on launch, on return to the app, and after edits. */
export function ReminderSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        rescheduleReminders(db).catch((e) => console.warn('Could not schedule reminders', e));
      }, DEBOUNCE_MS);
    };

    sync();
    const unsubscribe = subscribeToDataChanges(sync);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, [db]);

  return null;
}
