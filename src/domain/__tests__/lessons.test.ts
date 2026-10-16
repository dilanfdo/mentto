import type { Schedule, ScheduleException, Session } from '@/db/schedules';
import { ONCE } from '@/lib/recurrence';

import { expandLessons, forStudent, lessonStatus, type Owners } from '../lessons';

// The domain modules also export database loaders; only their pure functions are tested here.
// (jest hoists this above the imports.)
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

const slot = (over: Partial<Schedule>): Schedule => ({
  id: 's1',
  studentId: 'amaya',
  groupId: null,
  rule: { interval: 1, days: [2, 4] }, // Tue & Thu
  startTime: '16:00',
  durationMin: 45,
  startsOn: '2026-10-01',
  endsOn: null,
  location: null,
  ...over,
});

const owners: Owners = {
  students: new Map([
    ['amaya', 'Amaya Silva'],
    ['ravi', 'Ravi Kumar'],
    ['nila', 'Nila Perera'],
  ]),
  groups: new Map([
    [
      'choir',
      {
        name: 'Saturday choir',
        members: [
          { id: 'ravi', name: 'Ravi Kumar' },
          { id: 'nila', name: 'Nila Perera' },
        ],
      },
    ],
  ]),
};

const session = (studentId: string, scheduleId: string, startsAt: string, status: Session['status']): Session => ({
  id: `${studentId}-${startsAt}`,
  studentId,
  scheduleId,
  startsAt,
  durationMin: 45,
  status,
});

// Week of Mon 2026-10-12 … Sun 2026-10-18.
const week = { from: '2026-10-12', to: '2026-10-18' };

describe('expandLessons', () => {
  it('turns a weekly slot into dated lessons', () => {
    const lessons = expandLessons({ schedules: [slot({})], exceptions: [], sessions: [], owners, ...week });
    expect(lessons.map((l) => l.startsAt)).toEqual(['2026-10-13T16:00', '2026-10-15T16:00']);
    expect(lessons[0]).toMatchObject({ title: 'Amaya Silva', status: 'upcoming', once: false });
  });

  it('applies cancellations and moves to single lessons', () => {
    const exceptions: ScheduleException[] = [
      { id: 'e1', scheduleId: 's1', originalDate: '2026-10-13', kind: 'cancelled', newStartsAt: null },
      { id: 'e2', scheduleId: 's1', originalDate: '2026-10-15', kind: 'moved', newStartsAt: '2026-10-17T10:00' },
    ];
    const lessons = expandLessons({ schedules: [slot({})], exceptions, sessions: [], owners, ...week });
    expect(lessons).toHaveLength(2);
    expect(lessons[0]).toMatchObject({ date: '2026-10-13', status: 'cancelled' });
    expect(lessons[1]).toMatchObject({ date: '2026-10-17', startTime: '10:00', moved: true, originalDate: '2026-10-15' });
  });

  it('reads attendance for a one-to-one lesson', () => {
    const sessions = [session('amaya', 's1', '2026-10-13T16:00', 'attended')];
    const [tue, thu] = expandLessons({ schedules: [slot({})], exceptions: [], sessions, owners, ...week });
    expect(tue.status).toBe('attended');
    expect(thu.status).toBe('upcoming');
  });

  it('includes a one-off lesson only on its day', () => {
    const extra = slot({ id: 'x1', rule: ONCE, startsOn: '2026-10-16', endsOn: '2026-10-16', startTime: '09:00' });
    const lessons = expandLessons({ schedules: [extra], exceptions: [], sessions: [], owners, ...week });
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ date: '2026-10-16', once: true });
  });

  it('gives a group lesson one entry with every member', () => {
    const group = slot({ id: 'g1', studentId: null, groupId: 'choir', rule: { interval: 1, days: [6] } });
    const sessions = [session('ravi', 'g1', '2026-10-17T16:00', 'attended')];
    const [lesson] = expandLessons({ schedules: [group], exceptions: [], sessions, owners, ...week });
    expect(lesson.title).toBe('Saturday choir');
    expect(lesson.members).toEqual([
      { studentId: 'ravi', name: 'Ravi Kumar', status: 'attended' },
      { studentId: 'nila', name: 'Nila Perera', status: 'upcoming' },
    ]);
    // Not everyone is marked yet.
    expect(lesson.status).toBe('upcoming');
    // Each member sees their own attendance.
    expect(forStudent(lesson, 'ravi').status).toBe('attended');
    expect(forStudent(lesson, 'nila').status).toBe('upcoming');
  });

  it('drops lessons whose student or group is no longer active', () => {
    const lessons = expandLessons({
      schedules: [slot({ studentId: 'gone' }), slot({ id: 'g1', studentId: null, groupId: 'old-group' })],
      exceptions: [],
      sessions: [],
      owners,
      ...week,
    });
    expect(lessons).toEqual([]);
  });
});

describe('lessonStatus', () => {
  const m = (status: 'upcoming' | 'attended' | 'missed') => ({ studentId: status, name: status, status });

  it('settles once everyone is marked', () => {
    expect(lessonStatus([m('attended'), m('missed')], false)).toBe('attended');
    expect(lessonStatus([m('missed'), m('missed')], false)).toBe('missed');
    expect(lessonStatus([m('attended'), m('upcoming')], false)).toBe('upcoming');
    expect(lessonStatus([m('attended')], true)).toBe('cancelled');
  });
});
