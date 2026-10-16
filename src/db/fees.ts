import { addDays, parseDate, today, type ISODate } from '@/lib/dates';

import { newId, timestamp, write, type DB } from './core';

export type FeeKind = 'monthly' | 'term' | 'per_session';

export type FeePlan = {
  id: string;
  studentId: string;
  kind: FeeKind;
  amount: number;
  currency: string;
  /** Monthly and per-term plans: the day of the month fees fall due (1–28). */
  dueDay: number | null;
  /** Per-term plans: months per term (monthly plans are 1). */
  periodMonths: number | null;
  /** Monthly plans: the first due date. Per-lesson plans: the first lesson that is charged. */
  startsOn: ISODate;
  endsOn: ISODate | null;
};

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'other';

export type Payment = {
  id: string;
  studentId: string;
  amount: number;
  currency: string;
  paidOn: ISODate;
  method: PaymentMethod | null;
  note: string | null;
};

type PlanRow = {
  id: string;
  student_id: string;
  kind: FeeKind;
  amount: number;
  currency: string;
  due_day: number | null;
  period_months: number | null;
  starts_on: string;
  ends_on: string | null;
};

const toPlan = (r: PlanRow): FeePlan => ({
  id: r.id,
  studentId: r.student_id,
  kind: r.kind,
  amount: r.amount,
  currency: r.currency,
  dueDay: r.due_day,
  periodMonths: r.period_months,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
});

type PaymentRow = {
  id: string;
  student_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: PaymentMethod | null;
  note: string | null;
};

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  studentId: r.student_id,
  amount: r.amount,
  currency: r.currency,
  paidOn: r.paid_on,
  method: r.method,
  note: r.note,
});

export async function listPlans(db: DB, studentId?: string): Promise<FeePlan[]> {
  const rows = studentId
    ? await db.getAllAsync<PlanRow>('SELECT * FROM fee_plans WHERE student_id = ? ORDER BY starts_on', studentId)
    : await db.getAllAsync<PlanRow>('SELECT * FROM fee_plans ORDER BY starts_on');
  return rows.map(toPlan);
}

/** The plan in force today (or starting later), if any. */
export function currentPlan(plans: FeePlan[]): FeePlan | null {
  const t = today();
  return plans.filter((p) => !p.endsOn || p.endsOn >= t).at(-1) ?? null;
}

export type PlanInput = {
  kind: FeeKind;
  amount: number;
  currency: string;
  startsOn: ISODate;
  /** Months per term; only used by per-term plans. */
  periodMonths?: number;
};

/**
 * Starts a new plan. Earlier plans stop the day before it begins, so past charges keep the price
 * they had at the time.
 */
export async function savePlan(db: DB, studentId: string, input: PlanInput): Promise<void> {
  const existing = await listPlans(db, studentId);
  const dayBefore = addDays(input.startsOn, -1);
  const periodic = input.kind === 'monthly' || input.kind === 'term';
  const dueDay = periodic ? Math.min(parseDate(input.startsOn).getDate(), 28) : null;
  const periodMonths = input.kind === 'monthly' ? 1 : input.kind === 'term' ? (input.periodMonths ?? 3) : null;
  const now = timestamp();

  await write(db, async () => {
    for (const plan of existing) {
      if (plan.endsOn && plan.endsOn < input.startsOn) continue;
      if (plan.startsOn >= input.startsOn) {
        await db.runAsync('DELETE FROM fee_plans WHERE id = ?', plan.id);
      } else {
        await db.runAsync('UPDATE fee_plans SET ends_on = ?, updated_at = ? WHERE id = ?', dayBefore, now, plan.id);
      }
    }
    await db.runAsync(
      `INSERT INTO fee_plans (id, student_id, kind, amount, currency, due_day, period_months, starts_on, ends_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      newId(),
      studentId,
      input.kind,
      input.amount,
      input.currency,
      dueDay,
      periodMonths,
      input.startsOn,
      now,
      now,
    );
  });
}

/** Stops charging from tomorrow. Anything already due stays owed. */
export async function endPlan(db: DB, plan: FeePlan): Promise<void> {
  const t = today();
  await write(db, async () => {
    if (plan.startsOn > t) {
      await db.runAsync('DELETE FROM fee_plans WHERE id = ?', plan.id);
    } else {
      await db.runAsync('UPDATE fee_plans SET ends_on = ?, updated_at = ? WHERE id = ?', t, timestamp(), plan.id);
    }
  });
}

export async function listPayments(db: DB, studentId?: string, limit = 200): Promise<Payment[]> {
  const rows = studentId
    ? await db.getAllAsync<PaymentRow>(
        'SELECT * FROM payments WHERE student_id = ? ORDER BY paid_on DESC, created_at DESC LIMIT ?',
        studentId,
        limit,
      )
    : await db.getAllAsync<PaymentRow>(
        'SELECT * FROM payments ORDER BY paid_on DESC, created_at DESC LIMIT ?',
        limit,
      );
  return rows.map(toPayment);
}

export async function listAllPayments(db: DB): Promise<Payment[]> {
  const rows = await db.getAllAsync<PaymentRow>('SELECT * FROM payments');
  return rows.map(toPayment);
}

export type PaymentInput = Omit<Payment, 'id' | 'studentId'>;

export async function createPayment(db: DB, studentId: string, input: PaymentInput): Promise<void> {
  const now = timestamp();
  await write(db, async () => {
    await db.runAsync(
      `INSERT INTO payments (id, student_id, amount, currency, paid_on, period, method, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      newId(),
      studentId,
      input.amount,
      input.currency,
      input.paidOn,
      input.method,
      input.note?.trim() || null,
      now,
      now,
    );
  });
}

export async function deletePayment(db: DB, id: string): Promise<void> {
  await write(db, async () => {
    await db.runAsync('DELETE FROM payments WHERE id = ?', id);
  });
}
