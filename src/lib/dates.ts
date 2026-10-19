// Dates are stored as local, timezone-free strings: 'YYYY-MM-DD' for days, 'HH:MM' for times and
// 'YYYY-MM-DDTHH:MM' for moments. A tutor's lessons happen in their own local time, so there is
// nothing to convert, and string comparison sorts them correctly.

export type ISODate = string;
export type ISOTime = string;
export type LocalDateTime = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISOTime(d: Date): ISOTime {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseDate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDate(date: ISODate, time: ISOTime = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function joinDateTime(date: ISODate, time: ISOTime): LocalDateTime {
  return `${date}T${time}`;
}

export function splitDateTime(value: LocalDateTime): { date: ISODate; time: ISOTime } {
  const [date, time] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export function weekday(date: ISODate): number {
  return parseDate(date).getDay();
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: ISODate): ISODate {
  const offset = (weekday(date) + 6) % 7;
  return addDays(date, -offset);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export function addMinutes(time: ISOTime, minutes: number): ISOTime {
  const [hh, mm] = time.split(':').map(Number);
  const total = (((hh * 60 + mm + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The given day of month in the month of `date`, clamped to the month's length. */
export function withDayOfMonth(date: ISODate, day: number): ISODate {
  const d = parseDate(date);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), Math.min(day, last)));
}

export function addMonths(date: ISODate, months: number, day: number): ISODate {
  const d = parseDate(date);
  return withDayOfMonth(toISODate(new Date(d.getFullYear(), d.getMonth() + months, 1)), day);
}

// ── Formatting ──────────────────────────────────────────────────────────────

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, options);

const timeFormat = fmt({ hour: 'numeric', minute: '2-digit' });
const weekdayLong = fmt({ weekday: 'long' });
const weekdayShort = fmt({ weekday: 'short' });
const dayMonth = fmt({ day: 'numeric', month: 'short' });
const dayMonthYear = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const longDate = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const monthYear = fmt({ month: 'long', year: 'numeric' });
const monthLong = fmt({ month: 'long' });

export function formatTime(time: ISOTime): string {
  return timeFormat.format(toDate(today(), time));
}

export function formatTimeRange(time: ISOTime, durationMin: number): string {
  return `${formatTime(time)} – ${formatTime(addMinutes(time, durationMin))}`;
}

export function formatWeekday(date: ISODate, style: 'long' | 'short' = 'long'): string {
  return (style === 'long' ? weekdayLong : weekdayShort).format(parseDate(date));
}

export function formatLongDate(date: ISODate): string {
  return longDate.format(parseDate(date));
}

export function formatMonthYear(date: ISODate): string {
  return monthYear.format(parseDate(date));
}

export function formatMonth(date: ISODate): string {
  return monthLong.format(parseDate(date));
}

/** "Today", "Tomorrow", "Yesterday", or a short date ("12 Oct", with the year if not this year). */
export function formatRelativeDay(date: ISODate, reference: ISODate = today()): string {
  const diff = daysBetween(reference, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return weekdayLong.format(parseDate(date));
  return formatShortDate(date, reference);
}

/** formatRelativeDay for the middle of a sentence: "today", "tomorrow", "yesterday" in lower case. */
export function formatRelativeDayInline(date: ISODate, reference: ISODate = today()): string {
  const day = formatRelativeDay(date, reference);
  return ['Today', 'Tomorrow', 'Yesterday'].includes(day) ? day.toLowerCase() : day;
}

/** Always with the year, for documents that are kept: "3 Oct 2026". */
export function formatFullDate(date: ISODate): string {
  return dayMonthYear.format(parseDate(date));
}

export function formatShortDate(date: ISODate, reference: ISODate = today()): string {
  const sameYear = date.slice(0, 4) === reference.slice(0, 4);
  return (sameYear ? dayMonth : dayMonthYear).format(parseDate(date));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
