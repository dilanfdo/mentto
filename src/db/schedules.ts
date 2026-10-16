import { addDays, today, type ISODate, type ISOTime, type LocalDateTime } from '@/lib/dates';
import { formatRule, parseRule, type WeeklyRule } from '@/lib/recurrence';

import { newId, timestamp, write, type DB } from './core';

/** A slot belongs to exactly one student or one group. */
export type SlotOwner = { studentId: string; groupId?: undefined } | { groupId: string; studentId?: undefined };

export type Schedule = {
  id: string;
  studentId: string | null;
  groupId: string | null;
  rule: WeeklyRule;
  startTime: ISOTime;
  durationMin: number;
  startsOn: ISODate;
  endsOn: ISODate | null;
  location: string | null;
};

export type ScheduleInput = Omit<Schedule, 'id' | 'studentId' | 'groupId'>;

export type ScheduleException = {
  id: string;
  scheduleId: string;
  originalDate: ISODate;
  kind: 'cancelled' | 'moved';
  newStartsAt: LocalDateTime | null;
};

export type SessionStatus = 'attended' | 'missed' | 'cancelled';

export type Session = {
  id: string;
  studentId: string;
  scheduleId: string | null;
  startsAt: LocalDateTime;
  durationMin: number;
  status: SessionStatus;
};

type ScheduleRow = {
  id: string;
  student_id: string | null;
  group_id: string | null;
  rrule: string;
  start_time: string;
  duration_min: number;
  starts_on: string;
  ends_on: string | null;
  location: string | null;
};

const toSchedule = (r: ScheduleRow): Schedule => ({
  id: r.id,
  studentId: r.student_id,
  groupId: r.group_id,
  rule: parseRule(r.rrule),
  startTime: r.start_time,
  durationMin: r.duration_min,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  location: r.location,
});

/** Joins a slot to its owner so slots of archived students or groups drop out. */
const OWNER_JOIN = `LEFT JOIN students st ON st.id = s.student_id
  LEFT JOIN groups g ON g.id = s.group_id`;
const OWNER_ACTIVE = `(st.status = 'active' OR g.status = 'active')`;

/** Slots of active students and groups that overlap [from, to]. */
export async function listSchedulesInRange(db: DB, from: ISODate, to: ISODate): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT s.* FROM schedules s ${OWNER_JOIN}
     WHERE ${OWNER_ACTIVE} AND s.starts_on <= ? AND (s.ends_on IS NULL OR s.ends_on >= ?)`,
    to,
    from,
  );
  return rows.map(toSchedule);
}

/** A student's or group's slots that haven't ended (including upcoming one-off lessons). */
export async function listOwnerSchedules(db: DB, owner: SlotOwner): Promise<Schedule[]> {
  const column = owner.studentId ? 'student_id' : 'group_id';
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT * FROM schedules WHERE ${column} = ? AND (ends_on IS NULL OR ends_on >= ?)
     ORDER BY starts_on, start_time`,
    owner.studentId ?? owner.groupId,
    today(),
  );
  return rows.map(toSchedule);
}

/** Every current slot of active students and groups, with the owner's name, for clash checks and lists. */
export async function listActiveSchedules(db: DB): Promise<(Schedule & { ownerName: string })[]> {
  const rows = await db.getAllAsync<ScheduleRow & { owner_name: string }>(
    `SELECT s.*, COALESCE(st.name, g.name) AS owner_name FROM schedules s ${OWNER_JOIN}
     WHERE ${OWNER_ACTIVE} AND (s.ends_on IS NULL OR s.ends_on >= ?)`,
    today(),
  );
  return rows.map((r) => ({ ...toSchedule(r), ownerName: r.owner_name }));
}

export async function getSchedule(db: DB, id: string): Promise<Schedule | null> {
  const row = await db.getFirstAsync<ScheduleRow>('SELECT * FROM schedules WHERE id = ?', id);
  return row ? toSchedule(row) : null;
}

export async function saveSchedule(db: DB, owner: SlotOwner, input: ScheduleInput, id?: string): Promise<void> {
  const now = timestamp();
  // A one-off lesson is a slot that starts and ends on its day.
  const endsOn = input.rule.once ? input.startsOn : input.endsOn;
  await write(db, async () => {
    if (id) {
      await db.runAsync(
        `UPDATE schedules SET rrule = ?, start_time = ?, duration_min = ?, starts_on = ?, ends_on = ?, location = ?, updated_at = ?
         WHERE id = ?`,
        formatRule(input.rule),
        input.startTime,
        input.durationMin,
        input.startsOn,
        endsOn,
        input.location?.trim() || null,
        now,
        id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO schedules (id, student_id, group_id, rrule, start_time, duration_min, starts_on, ends_on, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        owner.studentId ?? null,
        owner.groupId ?? null,
        formatRule(input.rule),
        input.startTime,
        input.durationMin,
        input.startsOn,
        endsOn,
        input.location?.trim() || null,
        now,
        now,
      );
    }
  });
}

/** Removes a one-off lesson together with any attendance recorded for it. */
export async function deleteSchedule(db: DB, id: string): Promise<void> {
  await write(db, async () => {
    await db.runAsync('DELETE FROM sessions WHERE schedule_id = ?', id);
    await db.runAsync('DELETE FROM schedules WHERE id = ?', id);
  });
}

/**
 * Stops a slot from today on. Past lessons keep their history; a slot that never started is
 * removed outright.
 */
export async function endSchedule(db: DB, schedule: Schedule): Promise<void> {
  const yesterday = addDays(today(), -1);
  await write(db, async () => {
    if (schedule.startsOn > yesterday) {
      await db.runAsync('DELETE FROM schedules WHERE id = ?', schedule.id);
    } else {
      await db.runAsync(
        'UPDATE schedules SET ends_on = ?, updated_at = ? WHERE id = ?',
        yesterday,
        timestamp(),
        schedule.id,
      );
    }
  });
}

// ── Exceptions (one-off cancellations and moves) ───────────────────────────────

type ExceptionRow = {
  id: string;
  schedule_id: string;
  original_date: string;
  kind: 'cancelled' | 'moved';
  new_starts_at: string | null;
};

const toException = (r: ExceptionRow): ScheduleException => ({
  id: r.id,
  scheduleId: r.schedule_id,
  originalDate: r.original_date,
  kind: r.kind,
  newStartsAt: r.new_starts_at,
});

/** Exceptions whose original date or new date falls in [from, to]. */
export async function listExceptionsInRange(
  db: DB,
  from: ISODate,
  to: ISODate,
): Promise<ScheduleException[]> {
  const rows = await db.getAllAsync<ExceptionRow>(
    `SELECT * FROM schedule_exceptions
     WHERE (original_date BETWEEN ? AND ?) OR (substr(new_starts_at, 1, 10) BETWEEN ? AND ?)`,
    from,
    to,
    from,
    to,
  );
  return rows.map(toException);
}

export async function setException(
  db: DB,
  scheduleId: string,
  originalDate: ISODate,
  kind: 'cancelled' | 'moved',
  newStartsAt: LocalDateTime | null = null,
): Promise<void> {
  await write(db, async () => {
    await db.runAsync(
      `INSERT INTO schedule_exceptions (id, schedule_id, original_date, kind, new_starts_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(schedule_id, original_date) DO UPDATE SET kind = excluded.kind, new_starts_at = excluded.new_starts_at`,
      newId(),
      scheduleId,
      originalDate,
      kind,
      newStartsAt,
      timestamp(),
    );
    // Any attendance recorded against the lesson's old time no longer applies.
    await db.runAsync(
      `DELETE FROM sessions WHERE schedule_id = ? AND substr(starts_at, 1, 10) = ?`,
      scheduleId,
      originalDate,
    );
  });
}

export async function clearException(db: DB, scheduleId: string, originalDate: ISODate): Promise<void> {
  await write(db, async () => {
    await db.runAsync(
      'DELETE FROM schedule_exceptions WHERE schedule_id = ? AND original_date = ?',
      scheduleId,
      originalDate,
    );
  });
}

// ── Sessions (attendance) ─────────────────────────────────────────────────────

type SessionRow = {
  id: string;
  student_id: string;
  schedule_id: string | null;
  starts_at: string;
  duration_min: number;
  status: SessionStatus;
};

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  studentId: r.student_id,
  scheduleId: r.schedule_id,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  status: r.status,
});

export async function listSessionsInRange(db: DB, from: ISODate, to: ISODate): Promise<Session[]> {
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM sessions WHERE substr(starts_at, 1, 10) BETWEEN ? AND ?',
    from,
    to,
  );
  return rows.map(toSession);
}

export async function listAttendedSessions(db: DB, studentId?: string): Promise<Session[]> {
  const rows = studentId
    ? await db.getAllAsync<SessionRow>(
        `SELECT * FROM sessions WHERE status = 'attended' AND student_id = ?`,
        studentId,
      )
    : await db.getAllAsync<SessionRow>(`SELECT * FROM sessions WHERE status = 'attended'`);
  return rows.map(toSession);
}

/** Records one student's attendance at a lesson, replacing any earlier mark they had for it. */
export async function markLesson(
  db: DB,
  lesson: { studentId: string; scheduleId: string; startsAt: LocalDateTime; durationMin: number },
  status: 'attended' | 'missed' | null,
): Promise<void> {
  const now = timestamp();
  await write(db, async () => {
    await db.runAsync(
      'DELETE FROM sessions WHERE schedule_id = ? AND starts_at = ? AND student_id = ?',
      lesson.scheduleId,
      lesson.startsAt,
      lesson.studentId,
    );
    if (status) {
      await db.runAsync(
        `INSERT INTO sessions (id, student_id, schedule_id, starts_at, duration_min, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        lesson.studentId,
        lesson.scheduleId,
        lesson.startsAt,
        lesson.durationMin,
        status,
        now,
        now,
      );
    }
  });
}
