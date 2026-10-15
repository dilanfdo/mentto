import { getLocales } from 'expo-localization';

import { useQuery, write, type DB } from './core';

export type Settings = {
  onboarded: boolean;
  tutorName: string;
  currency: string;
  /** Minutes before a lesson to remind, or 0 for off. */
  lessonReminderMin: number;
  feeReminders: boolean;
  /** The tutor dismissed the Today hint about exact reminder times. */
  exactHintDismissed: boolean;
};

export function defaultCurrency(): string {
  return getLocales()[0]?.currencyCode ?? 'USD';
}

export async function getSettings(db: DB): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    onboarded: m.get('onboarded') === '1',
    tutorName: m.get('tutor_name') ?? '',
    currency: m.get('currency') ?? defaultCurrency(),
    lessonReminderMin: Number(m.get('lesson_reminder_min') ?? 30),
    feeReminders: (m.get('fee_reminders') ?? '1') === '1',
    exactHintDismissed: m.get('exact_hint_dismissed') === '1',
  };
}

const KEYS: Record<keyof Settings, string> = {
  onboarded: 'onboarded',
  tutorName: 'tutor_name',
  currency: 'currency',
  lessonReminderMin: 'lesson_reminder_min',
  feeReminders: 'fee_reminders',
  exactHintDismissed: 'exact_hint_dismissed',
};

export async function saveSettings(db: DB, patch: Partial<Settings>): Promise<void> {
  await write(db, async () => {
    for (const [k, v] of Object.entries(patch)) {
      const value = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
      await db.runAsync(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        KEYS[k as keyof Settings],
        value,
      );
    }
  });
}

export const useSettings = () => useQuery(getSettings, []);
