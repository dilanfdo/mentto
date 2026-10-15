import { daysBetween, startOfWeek, weekday, type ISODate } from './dates';

// Slots repeat weekly. They are stored as an RFC 5545 RRULE subset so the format can grow later
// (e.g. FREQ=MONTHLY) without a migration: FREQ=WEEKLY;INTERVAL=n;BYDAY=MO,WE.

const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export type WeeklyRule = {
  /** 1 = every week, 2 = every other week. */
  interval: number;
  /** Days of the week, 0 = Sunday … 6 = Saturday. */
  days: number[];
};

export function formatRule(rule: WeeklyRule): string {
  const days = [...rule.days].sort((a, b) => a - b).map((d) => CODES[d]);
  return `FREQ=WEEKLY;INTERVAL=${rule.interval};BYDAY=${days.join(',')}`;
}

export function parseRule(rrule: string): WeeklyRule {
  const parts = Object.fromEntries(
    rrule.split(';').map((p) => p.split('=') as [string, string]),
  );
  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  const days = (parts.BYDAY ?? '')
    .split(',')
    .map((c) => CODES.indexOf(c))
    .filter((d) => d >= 0);
  return { interval, days };
}

export function occursOn(
  rule: WeeklyRule,
  startsOn: ISODate,
  endsOn: ISODate | null,
  date: ISODate,
): boolean {
  if (date < startsOn || (endsOn && date > endsOn)) return false;
  if (!rule.days.includes(weekday(date))) return false;
  if (rule.interval === 1) return true;
  const weeks = daysBetween(startOfWeek(startsOn), startOfWeek(date)) / 7;
  return weeks % rule.interval === 0;
}

/** Days ordered Monday-first, the way most tutors read a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(day: number, style: 'short' | 'long' = 'short'): string {
  return (style === 'short' ? SHORT_NAMES : LONG_NAMES)[day];
}

/** "Every Tue & Thu", "Every other Mon", "Every day". */
export function describeRule(rule: WeeklyRule): string {
  const sorted = WEEK_ORDER.filter((d) => rule.days.includes(d));
  const prefix = rule.interval === 2 ? 'Every other' : 'Every';
  if (sorted.length === 7) return rule.interval === 2 ? 'Every other week, daily' : 'Every day';
  if (sorted.length === 1) return `${prefix} ${dayName(sorted[0], 'long')}`;
  const names = sorted.map((d) => dayName(d));
  return `${prefix} ${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
