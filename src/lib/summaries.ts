import type { Schedule } from '@/db/schedules';
import type { FeePlan } from '@/db/fees';

import { formatShortDate, formatTime, formatWeekday, ordinal } from './dates';
import { formatMoney } from './money';
import { dayName, describeRule, WEEK_ORDER } from './recurrence';

/** "Tue & Thu · 4:00 PM", or "3 weekly slots" when there are several. One-off lessons are left out. */
export function summarizeSlots(all: Schedule[]): string | null {
  const slots = all.filter((s) => !s.rule.once);
  if (slots.length === 0) return null;
  if (slots.length > 1) return `${slots.length} weekly slots`;
  const s = slots[0];
  const days = WEEK_ORDER.filter((d) => s.rule.days.includes(d)).map((d) => dayName(d));
  const prefix = s.rule.interval === 2 ? 'Every other ' : '';
  return `${prefix}${days.join(' & ')} · ${formatTime(s.startTime)}`;
}

export function describeSlot(s: Schedule): string {
  if (s.rule.once) return `${formatWeekday(s.startsOn, 'short')}, ${formatShortDate(s.startsOn)} · ${formatTime(s.startTime)}`;
  return `${describeRule(s.rule)} · ${formatTime(s.startTime)}`;
}

export function describePlan(plan: FeePlan): string {
  const amount = formatMoney(plan.amount, plan.currency);
  if (plan.kind === 'monthly') return `${amount} a month, due on the ${ordinal(plan.dueDay ?? 1)}`;
  if (plan.kind === 'term') return `${amount} a term, every ${termLength(plan.periodMonths ?? 3)}`;
  return `${amount} per lesson attended`;
}

/** "3 months", "6 months", "1 year". */
export function termLength(months: number): string {
  if (months === 12) return '1 year';
  return `${months} months`;
}

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};
