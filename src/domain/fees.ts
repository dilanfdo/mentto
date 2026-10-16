import { addMonths, today, type ISODate } from '@/lib/dates';
import type { DB } from '@/db/core';
import { currentPlan, listAllPayments, listPayments, listPlans, type FeePlan, type Payment } from '@/db/fees';
import { listAttendedSessions, type Session } from '@/db/schedules';

export type Charge = { date: ISODate; amount: number };

export type FeeStatus = {
  studentId: string;
  plan: FeePlan | null;
  currency: string;
  /** Charged minus paid. Positive means owed; negative means paid in advance. */
  balance: number;
  /** Oldest charge not yet covered by payments, if any. */
  unpaidSince: ISODate | null;
  /** The next charge after today on a monthly or per-term plan. */
  nextDue: Charge | null;
  totalPaid: number;
};

/** All charges up to and including `upTo`, oldest first. */
export function chargesFor(plans: FeePlan[], attended: Session[], upTo: ISODate): Charge[] {
  const charges: Charge[] = [];
  for (const plan of plans) {
    const end = plan.endsOn && plan.endsOn < upTo ? plan.endsOn : upTo;
    if (isPeriodic(plan)) {
      const day = plan.dueDay ?? 1;
      const step = periodMonths(plan);
      for (let d = plan.startsOn, i = 0; d <= end; i += 1, d = addMonths(plan.startsOn, i * step, day)) {
        charges.push({ date: d, amount: plan.amount });
      }
    } else {
      for (const s of attended) {
        const date = s.startsAt.slice(0, 10);
        if (date >= plan.startsOn && date <= end) charges.push({ date, amount: plan.amount });
      }
    }
  }
  return charges.sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly and per-term plans charge on a calendar schedule; per-lesson plans charge on attendance. */
export function isPeriodic(plan: FeePlan): boolean {
  return plan.kind === 'monthly' || plan.kind === 'term';
}

/** Months between charges: 1 for monthly, the term length for per-term plans. */
export function periodMonths(plan: FeePlan): number {
  return plan.kind === 'monthly' ? 1 : Math.max(1, plan.periodMonths ?? 3);
}

/** The first periodic charge after `after`, or null for per-lesson plans and ended plans. */
export function nextPeriodicCharge(plan: FeePlan | null, after: ISODate): Charge | null {
  if (!plan || !isPeriodic(plan)) return null;
  const day = plan.dueDay ?? 1;
  const step = periodMonths(plan);
  for (let i = 0, d = plan.startsOn; i < 600; i += 1, d = addMonths(plan.startsOn, i * step, day)) {
    if (plan.endsOn && d > plan.endsOn) return null;
    if (d > after) return { date: d, amount: plan.amount };
  }
  return null;
}

export function computeFeeStatus(
  studentId: string,
  plans: FeePlan[],
  payments: Payment[],
  attended: Session[],
  fallbackCurrency: string,
  on: ISODate = today(),
): FeeStatus {
  const charges = chargesFor(plans, attended, on);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const charged = charges.reduce((sum, c) => sum + c.amount, 0);

  // Payments settle the oldest charges first.
  let remaining = totalPaid;
  let unpaidSince: ISODate | null = null;
  for (const c of charges) {
    if (remaining >= c.amount) {
      remaining -= c.amount;
    } else {
      unpaidSince = c.date;
      break;
    }
  }

  const plan = currentPlan(plans);
  return {
    studentId,
    plan,
    currency: plan?.currency ?? plans.at(-1)?.currency ?? fallbackCurrency,
    balance: charged - totalPaid,
    unpaidSince,
    nextDue: nextPeriodicCharge(plan, on),
    totalPaid,
  };
}

export async function loadFeeStatus(db: DB, studentId: string, fallbackCurrency: string): Promise<FeeStatus> {
  const [plans, payments, attended] = await Promise.all([
    listPlans(db, studentId),
    listPayments(db, studentId, -1),
    listAttendedSessions(db, studentId),
  ]);
  return computeFeeStatus(studentId, plans, payments, attended, fallbackCurrency);
}

/** Fee status for every active student, keyed by student id. */
export async function loadAllFeeStatuses(db: DB, fallbackCurrency: string): Promise<Map<string, FeeStatus>> {
  const [students, plans, payments, attended] = await Promise.all([
    db.getAllAsync<{ id: string }>(`SELECT id FROM students WHERE status = 'active'`),
    listPlans(db),
    listAllPayments(db),
    listAttendedSessions(db),
  ]);
  const group = <T extends { studentId: string }>(items: T[]) => {
    const m = new Map<string, T[]>();
    for (const item of items) m.set(item.studentId, [...(m.get(item.studentId) ?? []), item]);
    return m;
  };
  const plansBy = group(plans);
  const paymentsBy = group(payments);
  const sessionsBy = group(attended);

  return new Map(
    students.map(({ id }) => [
      id,
      computeFeeStatus(id, plansBy.get(id) ?? [], paymentsBy.get(id) ?? [], sessionsBy.get(id) ?? [], fallbackCurrency),
    ]),
  );
}
