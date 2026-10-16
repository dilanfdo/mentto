import type { FeePlan, Payment } from '@/db/fees';
import type { Session } from '@/db/schedules';

import { chargesFor, computeFeeStatus, nextPeriodicCharge } from '../fees';

// The domain modules also export database loaders; only their pure functions are tested here.
// (jest hoists this above the imports.)
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

const plan = (over: Partial<FeePlan>): FeePlan => ({
  id: 'p1',
  studentId: 'amaya',
  kind: 'monthly',
  amount: 500000, // LKR 5,000.00
  currency: 'LKR',
  dueDay: 15,
  periodMonths: 1,
  startsOn: '2026-08-15',
  endsOn: null,
  ...over,
});

const paid = (amount: number, paidOn = '2026-10-01'): Payment => ({
  id: `${amount}-${paidOn}`,
  studentId: 'amaya',
  amount,
  currency: 'LKR',
  paidOn,
  method: 'cash',
  note: null,
});

const attended = (date: string): Session => ({
  id: date,
  studentId: 'amaya',
  scheduleId: 's1',
  startsAt: `${date}T16:00`,
  durationMin: 45,
  status: 'attended',
});

describe('monthly plans', () => {
  it('charges on the due day each month up to today', () => {
    const charges = chargesFor([plan({})], [], '2026-10-15');
    expect(charges.map((c) => c.date)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
  });

  it('settles the oldest charge first', () => {
    const status = computeFeeStatus('amaya', [plan({})], [paid(500000), paid(200000)], [], 'LKR', '2026-10-20');
    expect(status.balance).toBe(800000);
    expect(status.unpaidSince).toBe('2026-09-15');
    expect(status.nextDue).toEqual({ date: '2026-11-15', amount: 500000 });
  });

  it('treats overpayment as credit', () => {
    const status = computeFeeStatus('amaya', [plan({ startsOn: '2026-10-15' })], [paid(700000)], [], 'LKR', '2026-10-20');
    expect(status.balance).toBe(-200000);
    expect(status.unpaidSince).toBeNull();
  });

  it('keeps old prices for past charges after a price change', () => {
    const old = plan({ endsOn: '2026-09-30' });
    const raised = plan({ id: 'p2', amount: 600000, startsOn: '2026-10-15' });
    const amounts = chargesFor([old, raised], [], '2026-10-20').map((c) => c.amount);
    expect(amounts).toEqual([500000, 500000, 600000]);
  });
});

describe('per-term plans', () => {
  const term = plan({ kind: 'term', amount: 1500000, periodMonths: 3, startsOn: '2026-01-10', dueDay: 10 });

  it('charges once per term', () => {
    expect(chargesFor([term], [], '2026-10-20').map((c) => c.date)).toEqual([
      '2026-01-10',
      '2026-04-10',
      '2026-07-10',
      '2026-10-10',
    ]);
  });

  it('knows when the next term is due', () => {
    expect(nextPeriodicCharge(term, '2026-10-20')).toEqual({ date: '2027-01-10', amount: 1500000 });
  });
});

describe('per-lesson plans', () => {
  const perLesson = plan({ kind: 'per_session', amount: 150000, dueDay: null, periodMonths: null, startsOn: '2026-10-01' });

  it('charges only attended lessons on or after the start date', () => {
    const sessions = [attended('2026-09-29'), attended('2026-10-06'), attended('2026-10-08')];
    const status = computeFeeStatus('amaya', [perLesson], [paid(150000)], sessions, 'LKR', '2026-10-20');
    expect(status.balance).toBe(150000);
    expect(status.unpaidSince).toBe('2026-10-08');
    expect(status.nextDue).toBeNull();
  });
});

describe('no plan', () => {
  it('owes nothing and uses the app currency', () => {
    const status = computeFeeStatus('amaya', [], [], [], 'USD', '2026-10-20');
    expect(status).toMatchObject({ balance: 0, currency: 'USD', plan: null, nextDue: null });
  });
});
