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

  // 2: group classes, one-off lessons (rrule FREQ=ONCE, no schema change) and per-term fees.
  `
  CREATE TABLE groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    added_on TEXT NOT NULL,
    PRIMARY KEY (group_id, student_id)
  );

  -- A slot now belongs to either one student or one group.
  CREATE TABLE schedules_new (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    rrule TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    location TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((student_id IS NULL) <> (group_id IS NULL))
  );
  INSERT INTO schedules_new (id, student_id, group_id, rrule, start_time, duration_min, starts_on, ends_on, location, created_at, updated_at)
    SELECT id, student_id, NULL, rrule, start_time, duration_min, starts_on, ends_on, location, created_at, updated_at
    FROM schedules;
  DROP TABLE schedules;
  ALTER TABLE schedules_new RENAME TO schedules;
  CREATE INDEX idx_schedules_student ON schedules (student_id);
  CREATE INDEX idx_schedules_group ON schedules (group_id);
  CREATE INDEX idx_group_members_student ON group_members (student_id);

  -- How many months a monthly (1) or per-term (2, 3, 4, 6…) plan covers.
  ALTER TABLE fee_plans ADD COLUMN period_months INTEGER;
  UPDATE fee_plans SET period_months = 1 WHERE kind = 'monthly';
  `,
];

/** The schema version a fully migrated database reports in PRAGMA user_version. */
export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // Wait for a lock rather than fail, e.g. while a previous connection is closing on reload.
  await db.execAsync('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  const mode = await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode');
  if (mode?.journal_mode !== 'wal') await db.execAsync('PRAGMA journal_mode = WAL');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= MIGRATIONS.length) return;

  // Some migrations rebuild a table. With foreign keys on, dropping the old table would cascade
  // and delete its children, so they're off while migrating and checked afterwards. (The pragma
  // has no effect inside a transaction, which is why it's set out here.)
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    while (version < MIGRATIONS.length) {
      const migration = MIGRATIONS[version];
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration);
        const broken = await db.getAllAsync('PRAGMA foreign_key_check');
        if (broken.length > 0) throw new Error(`Migration ${version + 1} left ${broken.length} broken references`);
        await db.execAsync(`PRAGMA user_version = ${version + 1}`);
      });
      version += 1;
    }
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}
