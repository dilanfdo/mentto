import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DB } from '@/db/core';
import { getSettings } from '@/db/settings';
import { loadAllFeeStatuses } from '@/domain/fees';
import { loadLessons } from '@/domain/lessons';
import { addDays, formatShortDate, formatTime, toDate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

// Reminders are local notifications scheduled on this device. We keep a rolling window: on every
// data change and app start, cancel everything and schedule the next WINDOW_DAYS again. iOS caps
// pending notifications at 64, so MAX_PENDING stays under that.

const WINDOW_DAYS = 14;
const MAX_PENDING = 60;
const FEE_REMINDER_HOUR = 9;

export const CHANNELS = { lessons: 'lessons', fees: 'fees' } as const;

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNELS.lessons, {
      name: 'Lesson reminders',
      description: 'A heads-up before each lesson',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.fees, {
      name: 'Fee reminders',
      description: 'When a student’s fee falls due',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<PermissionState> {
  await configureNotifications();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

type Planned = { at: Date; title: string; body: string; channelId: string };

export async function rescheduleReminders(db: DB): Promise<void> {
  if ((await getPermission()) !== 'granted') return;
  await configureNotifications();

  const settings = await getSettings(db);
  const now = Date.now();
  const from = today();
  const to = addDays(from, WINDOW_DAYS);
  const planned: Planned[] = [];

  if (settings.lessonReminderMin > 0) {
    const lessons = await loadLessons(db, from, to);
    for (const lesson of lessons) {
      if (lesson.status !== 'upcoming') continue;
      const at = new Date(toDate(lesson.date, lesson.startTime).getTime() - settings.lessonReminderMin * 60_000);
      if (at.getTime() <= now) continue;
      planned.push({
        at,
        title: `${lesson.studentName} at ${formatTime(lesson.startTime)}`,
        body: lesson.location
          ? `Lesson in ${settings.lessonReminderMin} min · ${lesson.location}`
          : `Lesson in ${settings.lessonReminderMin} min`,
        channelId: CHANNELS.lessons,
      });
    }
  }

  if (settings.feeReminders) {
    const statuses = await loadAllFeeStatuses(db, settings.currency);
    const names = new Map(
      (await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM students')).map((s) => [s.id, s.name]),
    );
    for (const status of statuses.values()) {
      const due = status.nextDue;
      if (!due || due.date > to) continue;
      const at = toDate(due.date, `${String(FEE_REMINDER_HOUR).padStart(2, '0')}:00`);
      if (at.getTime() <= now) continue;
      const owed = status.balance + due.amount;
      if (owed <= 0) continue; // already paid in advance
      planned.push({
        at,
        title: `Fee due: ${names.get(status.studentId) ?? 'Student'}`,
        body: `${formatMoney(owed, status.currency)} due today (${formatShortDate(due.date)})`,
        channelId: CHANNELS.fees,
      });
    }
  }

  planned.sort((a, b) => a.at.getTime() - b.at.getTime());

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of planned.slice(0, MAX_PENDING)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: p.channelId },
    });
  }
}
