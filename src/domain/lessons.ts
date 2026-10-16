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
import { loadGroupMembers } from '@/db/groups';
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
export type MemberStatus = 'upcoming' | 'attended' | 'missed';

export type LessonMember = { studentId: string; name: string; status: MemberStatus };

/** One occurrence of a slot on a specific day, with any one-off change applied. */
export type Lesson = {
  key: string;
  scheduleId: string;
  /** Set for a one-to-one lesson. */
  studentId: string | null;
  /** Set for a group lesson. */
  groupId: string | null;
  /** The student's or the group's name. */
  title: string;
  /** Everyone expected at the lesson: the one student, or the group's active members. */
  members: LessonMember[];
  /** The day the slot originally fell on. Exceptions are keyed by this. */
  originalDate: ISODate;
  date: ISODate;
  startTime: ISOTime;
  startsAt: LocalDateTime;
  durationMin: number;
  location: string | null;
  /**
   * Cancelled, or once everyone is marked: attended if anyone came, otherwise missed. Upcoming
   * until then.
   */
  status: LessonStatus;
  moved: boolean;
  /** A one-off lesson rather than an occurrence of a weekly slot. */
  once: boolean;
};

export type Owners = {
  /** Active student names by id. */
  students: Map<string, string>;
  /** Active groups by id, with their active members. */
  groups: Map<string, { name: string; members: { id: string; name: string }[] }>;
};

type ExpandInput = {
  schedules: Schedule[];
  exceptions: ScheduleException[];
  sessions: Session[];
  owners: Owners;
  from: ISODate;
  to: ISODate;
};

export function lessonStatus(members: LessonMember[], cancelled: boolean): LessonStatus {
  if (cancelled) return 'cancelled';
  if (members.length === 0 || members.some((m) => m.status === 'upcoming')) return 'upcoming';
  return members.some((m) => m.status === 'attended') ? 'attended' : 'missed';
}

export function expandLessons({ schedules, exceptions, sessions, owners, from, to }: ExpandInput): Lesson[] {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const exceptionFor = new Map(exceptions.map((e) => [`${e.scheduleId}:${e.originalDate}`, e]));
  const sessionFor = new Map(
    sessions
      .filter((s) => s.scheduleId && s.status !== 'cancelled')
      .map((s) => [`${s.scheduleId}:${s.startsAt}:${s.studentId}`, s]),
  );

  const lessons: Lesson[] = [];
  const add = (schedule: Schedule, originalDate: ISODate, startsAt: LocalDateTime, moved: boolean, cancelled: boolean) => {
    const group = schedule.groupId ? owners.groups.get(schedule.groupId) : undefined;
    const studentName = schedule.studentId ? owners.students.get(schedule.studentId) : undefined;
    if (!group && studentName === undefined) return; // owner archived or gone

    const people = group ? group.members : [{ id: schedule.studentId!, name: studentName! }];
    const members: LessonMember[] = people.map((p) => {
      const session = sessionFor.get(`${schedule.id}:${startsAt}:${p.id}`);
      return { studentId: p.id, name: p.name, status: session ? (session.status as MemberStatus) : 'upcoming' };
    });

    const { date, time } = splitDateTime(startsAt);
    lessons.push({
      key: `${schedule.id}:${originalDate}`,
      scheduleId: schedule.id,
      studentId: schedule.studentId,
      groupId: schedule.groupId,
      title: group ? group.name : studentName!,
      members,
      originalDate,
      date,
      startTime: time,
      startsAt,
      durationMin: schedule.durationMin,
      location: schedule.location,
      status: lessonStatus(members, cancelled),
      moved,
      once: !!schedule.rule.once,
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

  return lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
}

/**
 * One student's view of a lesson: for a group lesson, its status is that student's own
 * attendance (or cancelled).
 */
export function forStudent(lesson: Lesson, studentId: string): Lesson {
  if (!lesson.groupId) return lesson;
  const me = lesson.members.find((m) => m.studentId === studentId);
  return {
    ...lesson,
    status: lesson.status === 'cancelled' ? 'cancelled' : me && me.status !== 'upcoming' ? me.status : 'upcoming',
  };
}

export async function loadOwners(db: DB): Promise<Owners> {
  const [students, groups, members] = await Promise.all([
    db.getAllAsync<{ id: string; name: string }>(`SELECT id, name FROM students WHERE status = 'active'`),
    db.getAllAsync<{ id: string; name: string }>(`SELECT id, name FROM groups WHERE status = 'active'`),
    loadGroupMembers(db),
  ]);
  return {
    students: new Map(students.map((s) => [s.id, s.name])),
    groups: new Map(groups.map((g) => [g.id, { name: g.name, members: members.get(g.id) ?? [] }])),
  };
}

type Filter = { studentId?: string; groupId?: string };

/**
 * Lessons between two dates. With a studentId, the student's own lessons plus the group lessons
 * they're in, seen from their side. With a groupId, that group's lessons.
 */
export async function loadLessons(db: DB, from: ISODate, to: ISODate, filter: Filter = {}): Promise<Lesson[]> {
  const [schedules, exceptions, sessions, owners] = await Promise.all([
    listSchedulesInRange(db, from, to),
    listExceptionsInRange(db, from, to),
    listSessionsInRange(db, from, to),
    loadOwners(db),
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

  const { studentId, groupId } = filter;
  const inScope = (s: Schedule) => {
    if (groupId) return s.groupId === groupId;
    if (!studentId) return true;
    if (s.studentId === studentId) return true;
    return !!s.groupId && !!owners.groups.get(s.groupId)?.members.some((m) => m.id === studentId);
  };

  const lessons = expandLessons({ schedules: schedules.filter(inScope), exceptions, sessions, owners, from, to });
  return studentId ? lessons.map((l) => forStudent(l, studentId)) : lessons;
}

/** The next lesson that hasn't started yet, looking up to `days` ahead. */
export async function loadNextLesson(db: DB, filter: Filter = {}, days = 35): Promise<Lesson | null> {
  const now = new Date();
  const nowStamp = joinDateTime(toISODate(now), toISOTime(now));
  const lessons = await loadLessons(db, today(), addDays(today(), days), filter);
  return lessons.find((l) => l.status !== 'cancelled' && l.startsAt >= nowStamp) ?? null;
}

/** Lessons can be marked once it's their day, never ahead of time. */
export function canMarkAttendance(lesson: Lesson): boolean {
  return lesson.status !== 'cancelled' && lesson.date <= today();
}

export function attendedCount(lesson: Lesson): number {
  return lesson.members.filter((m) => m.status === 'attended').length;
}
