import {
  addDays,
  eachDay,
  joinDateTime,
  splitDateTime,
  today,
  toISODate,
  toISOTime,
  type ISODate,
  type ISOTime,
  type LocalDateTime,
} from '@/lib/dates';
import { occursOn } from '@/lib/recurrence';
import type { DB } from '@/db/core';
import {
  getSchedule,
  listExceptionsInRange,
  listSchedulesInRange,
  listSessionsInRange,
  type Schedule,
  type ScheduleException,
  type Session,
} from '@/db/schedules';

export type LessonStatus = 'upcoming' | 'attended' | 'missed' | 'cancelled';

/** One occurrence of a recurring slot on a specific day, with any one-off change applied. */
export type Lesson = {
  key: string;
  scheduleId: string;
  studentId: string;
  studentName: string;
  /** The day the slot originally fell on. Exceptions are keyed by this. */
  originalDate: ISODate;
  date: ISODate;
  startTime: ISOTime;
  startsAt: LocalDateTime;
  durationMin: number;
  location: string | null;
  status: LessonStatus;
  moved: boolean;
};

type ExpandInput = {
  schedules: Schedule[];
  exceptions: ScheduleException[];
  sessions: Session[];
  names: Map<string, string>;
  from: ISODate;
  to: ISODate;
};

export function expandLessons({ schedules, exceptions, sessions, names, from, to }: ExpandInput): Lesson[] {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const exceptionFor = new Map(exceptions.map((e) => [`${e.scheduleId}:${e.originalDate}`, e]));
  const sessionFor = new Map(
    sessions.filter((s) => s.scheduleId).map((s) => [`${s.scheduleId}:${s.startsAt}`, s]),
  );

  const lessons: Lesson[] = [];
  const add = (schedule: Schedule, originalDate: ISODate, startsAt: LocalDateTime, moved: boolean, cancelled: boolean) => {
    const { date, time } = splitDateTime(startsAt);
    const session = sessionFor.get(`${schedule.id}:${startsAt}`);
    lessons.push({
      key: `${schedule.id}:${originalDate}`,
      scheduleId: schedule.id,
      studentId: schedule.studentId,
      studentName: names.get(schedule.studentId) ?? 'Student',
      originalDate,
      date,
      startTime: time,
      startsAt,
      durationMin: schedule.durationMin,
      location: schedule.location,
      status: cancelled ? 'cancelled' : session && session.status !== 'cancelled' ? session.status : 'upcoming',
      moved,
    });
  };

  for (const day of eachDay(from, to)) {
    for (const schedule of schedules) {
      if (!occursOn(schedule.rule, schedule.startsOn, schedule.endsOn, day)) continue;
      const exception = exceptionFor.get(`${schedule.id}:${day}`);
      if (exception?.kind === 'moved') continue; // shown on its new day below
      add(schedule, day, joinDateTime(day, schedule.startTime), false, exception?.kind === 'cancelled');
    }
  }

  for (const e of exceptions) {
    if (e.kind !== 'moved' || !e.newStartsAt) continue;
    const newDate = e.newStartsAt.slice(0, 10);
    const schedule = byId.get(e.scheduleId);
    if (!schedule || newDate < from || newDate > to) continue;
    add(schedule, e.originalDate, e.newStartsAt, true, false);
  }

  return lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.studentName.localeCompare(b.studentName));
}

export async function loadLessons(
  db: DB,
  from: ISODate,
  to: ISODate,
  studentId?: string,
): Promise<Lesson[]> {
  const [schedules, exceptions, sessions, students] = await Promise.all([
    listSchedulesInRange(db, from, to),
    listExceptionsInRange(db, from, to),
    listSessionsInRange(db, from, to),
    db.getAllAsync<{ id: string; name: string }>(`SELECT id, name FROM students WHERE status = 'active'`),
  ]);

  // A lesson moved into this range may belong to a slot that otherwise falls outside it.
  const known = new Set(schedules.map((s) => s.id));
  for (const e of exceptions) {
    if (e.kind === 'moved' && !known.has(e.scheduleId)) {
      const s = await getSchedule(db, e.scheduleId);
      if (s) {
        schedules.push(s);
        known.add(s.id);
      }
    }
  }

  const names = new Map(students.map((s) => [s.id, s.name]));
  const active = schedules.filter((s) => names.has(s.studentId) && (!studentId || s.studentId === studentId));
  return expandLessons({ schedules: active, exceptions, sessions, names, from, to });
}

/** The next lesson that hasn't started yet, looking up to `days` ahead. */
export async function loadNextLesson(db: DB, studentId?: string, days = 35): Promise<Lesson | null> {
  const now = new Date();
  const nowStamp = joinDateTime(toISODate(now), toISOTime(now));
  const lessons = await loadLessons(db, today(), addDays(today(), days), studentId);
  return lessons.find((l) => l.status === 'upcoming' && l.startsAt >= nowStamp) ?? null;
}

/** Lessons can be marked once they've started (or on their day), never ahead of time. */
export function canMarkAttendance(lesson: Lesson): boolean {
  return lesson.status !== 'cancelled' && lesson.date <= today();
}
