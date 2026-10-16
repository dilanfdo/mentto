import { addMonths, withDayOfMonth } from '../dates';
import { describeRule, formatRule, occursOn, ONCE, parseRule } from '../recurrence';

// 2026-10-12 is a Monday.
describe('weekly rules', () => {
  const tueThu = { interval: 1, days: [2, 4] };

  it('round-trips through the stored RRULE', () => {
    expect(formatRule(tueThu)).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH');
    expect(parseRule('FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH')).toEqual(tueThu);
  });

  it('occurs only on its days, within its dates', () => {
    expect(occursOn(tueThu, '2026-10-13', null, '2026-10-13')).toBe(true); // Tue
    expect(occursOn(tueThu, '2026-10-13', null, '2026-10-14')).toBe(false); // Wed
    expect(occursOn(tueThu, '2026-10-13', null, '2026-10-06')).toBe(false); // before start
    expect(occursOn(tueThu, '2026-10-13', '2026-10-20', '2026-10-22')).toBe(false); // after end
  });

  it('skips alternate weeks when every other week', () => {
    const fortnightly = { interval: 2, days: [1] };
    expect(occursOn(fortnightly, '2026-10-12', null, '2026-10-12')).toBe(true);
    expect(occursOn(fortnightly, '2026-10-12', null, '2026-10-19')).toBe(false);
    expect(occursOn(fortnightly, '2026-10-12', null, '2026-10-26')).toBe(true);
  });

  it('describes itself for people', () => {
    expect(describeRule(tueThu)).toBe('Every Tue & Thu');
    expect(describeRule({ interval: 2, days: [1] })).toBe('Every other Monday');
  });
});

describe('one-off lessons', () => {
  it('round-trips as FREQ=ONCE', () => {
    expect(formatRule(ONCE)).toBe('FREQ=ONCE');
    expect(parseRule('FREQ=ONCE').once).toBe(true);
  });

  it('happens only on its start date', () => {
    expect(occursOn(ONCE, '2026-10-20', '2026-10-20', '2026-10-20')).toBe(true);
    expect(occursOn(ONCE, '2026-10-20', '2026-10-20', '2026-10-27')).toBe(false);
    expect(describeRule(ONCE)).toBe('One-off lesson');
  });
});

describe('month arithmetic', () => {
  it('clamps to the end of short months', () => {
    expect(withDayOfMonth('2026-02-01', 31)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2, 31)).toBe('2026-03-31');
  });
});
