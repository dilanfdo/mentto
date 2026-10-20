// Runs the real reminder planner against a real SQLite database (Node's built-in sqlite, wrapped in
// the slice of the expo-sqlite API the app uses), so queries, lesson expansion and planning are
// all exercised together.
import type { DB } from '@/db/core';

const scheduled: { date: Date; title: string }[] = [];

jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `id-${++n}` };
});
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: async () => ({ status: 'granted' }),
  cancelAllScheduledNotificationsAsync: async () => {
    scheduled.length = 0;
  },
  scheduleNotificationAsync: async ({ content, trigger }: { content: { title: string }; trigger: { date: Date } }) => {
    scheduled.push({ date: trigger.date, title: content.title });
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { migrateDatabase } = require('@/db/schema');
const { createStudent } = require('@/db/students');
const { saveSchedule, setException } = require('@/db/schedules');
const { rescheduleReminders } = require('../reminders');
/* eslint-enable @typescript-eslint/no-require-imports */

function openTestDb(): DB {
  // jest's resolver doesn't know node:sqlite, so ask Node for it directly.
  const { DatabaseSync } = (process as unknown as { getBuiltinModule: (id: string) => any }).getBuiltinModule('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    getAllAsync: async (sql: string, ...args: unknown[]) => raw.prepare(sql).all(...args),
    getFirstAsync: async (sql: string, ...args: unknown[]) => raw.prepare(sql).get(...args) ?? null,
    runAsync: async (sql: string, ...args: unknown[]) => raw.prepare(sql).run(...args),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db as unknown as DB;
}

const at = (iso: string) => new Date(iso).getTime();

describe('rescheduleReminders', () => {
  let db: DB;
  let studentId: string;

  beforeEach(async () => {
    scheduled.length = 0;
    jest.useFakeTimers({ now: new Date('2026-10-20T13:48:00') }); // Tuesday
    db = openTestDb();
    await migrateDatabase(db);
    studentId = await createStudent(db, {
      name: 'Ravi Kumar',
      phone: null,
      email: null,
      guardianName: null,
      guardianPhone: null,
      notes: null,
    });
    await saveSchedule(db, { studentId }, {
      rule: { interval: 1, days: [2, 3] }, // Tue & Wed
      startTime: '15:30',
      durationMin: 90,
      startsOn: '2026-10-01',
      endsOn: null,
      location: null,
    });
  });

  afterEach(() => jest.useRealTimers());

  it('reminds 30 minutes before each lesson', async () => {
    await rescheduleReminders(db);
    expect(scheduled[0]).toMatchObject({ title: 'Ravi Kumar' });
    expect(scheduled[0].date.getTime()).toBe(at('2026-10-20T15:00'));
  });

  it('reminds before a lesson moved to an earlier time the same day', async () => {
    const { listSchedulesInRange } = jest.requireActual('@/db/schedules');
    const [slot] = await listSchedulesInRange(db, '2026-10-20', '2026-10-20');
    await setException(db, slot.id, '2026-10-20', 'moved', '2026-10-20T14:20');

    await rescheduleReminders(db);
    const times = scheduled.map((s) => s.date.getTime());
    expect(times).toContain(at('2026-10-20T13:50'));
    expect(times).not.toContain(at('2026-10-20T15:00'));
  });

  it('reminds before a moved one-off lesson', async () => {
    await saveSchedule(db, { studentId }, {
      rule: { interval: 1, days: [], once: true },
      startTime: '16:30',
      durationMin: 60,
      startsOn: '2026-10-20',
      endsOn: null,
      location: null,
    });
    const { listSchedulesInRange } = jest.requireActual('@/db/schedules');
    const once = (await listSchedulesInRange(db, '2026-10-20', '2026-10-20')).find((s: { rule: { once?: boolean } }) => s.rule.once);
    await setException(db, once.id, '2026-10-20', 'moved', '2026-10-20T14:40');

    await rescheduleReminders(db);
    expect(scheduled.map((s) => s.date.getTime())).toContain(at('2026-10-20T14:10'));
  });
});
