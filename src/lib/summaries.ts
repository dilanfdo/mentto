import type { Schedule } from '@/db/schedules';
import type { FeePlan } from '@/db/fees';

import { formatTime, ordinal } from './dates';
import { formatMoney } from './money';
import { dayName, describeRule, WEEK_ORDER } from './recurrence';

/** "Tue & Thu · 4:00 PM", or "3 weekly slots" when a student has several. */
export function summarizeSlots(slots: Schedule[]): string | null {
  if (slots.length === 0) return null;
  if (slots.length > 1) return `${slots.length} weekly slots`;
  const s = slots[0];
  const days = WEEK_ORDER.filter((d) => s.rule.days.includes(d)).map((d) => dayName(d));
  const prefix = s.rule.interval === 2 ? 'Every other ' : '';
  return `${prefix}${days.join(' & ')} · ${formatTime(s.startTime)}`;
}

export function describeSlot(s: Schedule): string {
  return `${describeRule(s.rule)} · ${formatTime(s.startTime)}`;
}

export function describePlan(plan: FeePlan): string {
  const amount = formatMoney(plan.amount, plan.currency);
  return plan.kind === 'monthly'
    ? `${amount} a month, due on the ${ordinal(plan.dueDay ?? 1)}`
    : `${amount} per lesson attended`;
}

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};
