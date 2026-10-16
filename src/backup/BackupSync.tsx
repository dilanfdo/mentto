import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { subscribeToDataChanges } from '@/lib/events';

import { backupNow, retryBackup, scheduleBackup, startBackup } from './engine';

/** Runs the Drive auto-backup: after edits settle, when the app is left, and when it's back online. */
export function BackupSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    startBackup(db).catch((e) => console.warn('Could not start backup', e));
    const unsubscribe = subscribeToDataChanges(scheduleBackup);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'background') void backupNow();
      else if (s === 'active') retryBackup();
    });
    let online: boolean | null = null;
    const net = NetInfo.addEventListener((n) => {
      // Reachability is confirmed a moment after the connection itself, so wait for both.
      const now = n.isConnected !== false && n.isInternetReachable !== false;
      if (online === false && now) retryBackup();
      online = now;
    });
    return () => {
      unsubscribe();
      appState.remove();
      net();
    };
  }, [db]);

  return null;
}
