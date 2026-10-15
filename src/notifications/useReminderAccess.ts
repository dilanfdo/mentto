import { canScheduleExactAlarms } from '@modules/exact-alarms';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getPermission, type PermissionState } from './reminders';

/**
 * Whether reminders can reach the tutor (notification permission) and arrive on time (exact
 * alarms). Re-checked whenever the app returns to the foreground, e.g. from Android settings.
 */
export function useReminderAccess() {
  const [notifications, setNotifications] = useState<PermissionState | null>(null);
  const [exact, setExact] = useState(true);

  const refresh = useCallback(() => {
    getPermission()
      .then(setNotifications)
      .catch(() => {});
    setExact(canScheduleExactAlarms());
  }, []);

  useEffect(() => {
    const initial = setTimeout(refresh, 0);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearTimeout(initial);
      sub.remove();
    };
  }, [refresh]);

  return { notifications, exact, refresh, setNotifications };
}
