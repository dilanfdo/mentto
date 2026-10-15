import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'mentto.db';

// Each entry upgrades the database by one version, tracked in PRAGMA user_version.
// Never edit a migration that has shipped; append a new one instead.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE students (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- How a student is billed. Amounts are stored in minor units (cents) to avoid float rounding.
  CREATE TABLE fee_plans (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('monthly', 'per_session', 'term')),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    due_day INTEGER CHECK (due_day BETWEEN 1 AND 28),
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- A recurring time slot. Recurrence is an RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=TU,TH.
  CREATE TABLE schedules (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rrule TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    location TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- One-off changes to a recurring slot: a cancelled date or a session moved elsewhere.
  CREATE TABLE schedule_exceptions (
    id TEXT PRIMARY KEY NOT NULL,
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    original_date TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('cancelled', 'moved')),
    new_starts_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (schedule_id, original_date)
  );

  -- A session that actually happened (or was missed); drives attendance and per-session fees.
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    schedule_id TEXT REFERENCES schedules(id) ON DELETE SET NULL,
    starts_at TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('attended', 'missed', 'cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE payments (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    paid_on TEXT NOT NULL,
    period TEXT,
    method TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Key/value app state, e.g. the change counter the auto-backup uses to know it is dirty.
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX idx_sessions_student_starts ON sessions (student_id, starts_at);
  CREATE INDEX idx_payments_student_paid ON payments (student_id, paid_on);
  CREATE INDEX idx_schedules_student ON schedules (student_id);
  `,
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
}
