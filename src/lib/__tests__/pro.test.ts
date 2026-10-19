import { FREE_LIMITS, overLimit } from '@/billing/limits';

import { DEFAULT_TEMPLATES, fillTemplate } from '../templates';

describe('free limits', () => {
  it('allows adding up to the limit, then asks for Pro', () => {
    expect(overLimit(FREE_LIMITS.students - 1, 'students', false)).toBe(false);
    expect(overLimit(FREE_LIMITS.students, 'students', false)).toBe(true);
    expect(overLimit(FREE_LIMITS.groups, 'groups', false)).toBe(true);
  });

  it('never limits Pro', () => {
    expect(overLimit(500, 'students', true)).toBe(false);
    expect(overLimit(50, 'groups', true)).toBe(false);
  });
});

describe('message templates', () => {
  it('fills placeholders', () => {
    const text = fillTemplate(DEFAULT_TEMPLATES.feeReminder, {
      name: 'Amaya',
      amount: 'LKR 12,000',
      due: 'is due today',
      tutor: 'Nadia',
    });
    expect(text).toBe('Hi Amaya, a friendly reminder that the lesson fee of LKR 12,000 is due today. Thank you!\n– Nadia');
  });

  it('drops the sign-off when the tutor has no name set', () => {
    const text = fillTemplate(DEFAULT_TEMPLATES.feeReminder, { name: 'Amaya', amount: 'x', due: 'is due', tutor: '' });
    expect(text.endsWith('Thank you!')).toBe(true);
  });

  it('leaves unknown placeholders as written', () => {
    expect(fillTemplate('Hi {name}, see {link}', { name: 'Ravi' })).toBe('Hi Ravi, see {link}');
  });
});
