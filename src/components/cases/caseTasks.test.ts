import { describe, expect, it } from 'vitest';
import { deriveCaseTasks } from './caseTasks';

const NOW = new Date('2026-08-08T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const base = {
  status: 'contacted',
  lastActivityAt: daysAgo(0),
  submission: null,
  documents: [{ category: 'passport' }],
  appointments: [] as { id: string; scheduled_at: string; outcome: string | null }[],
  forgottenDays: 7,
  now: NOW,
};

describe('deriveCaseTasks', () => {
  it('returns nothing when the case is healthy', () => {
    expect(
      deriveCaseTasks({
        ...base,
        status: 'appointment_scheduled',
        appointments: [{ id: 'a', scheduled_at: daysAgo(-1), outcome: null }],
      }),
    ).toEqual([]);
  });

  it('flags a missing appointment on a stage that expects one', () => {
    const tasks = deriveCaseTasks(base);
    expect(tasks.map((t) => t.action)).toContain('schedule_appointment');
  });

  it('flags an appointment in the past with no outcome', () => {
    const tasks = deriveCaseTasks({
      ...base,
      appointments: [{ id: 'a1', scheduled_at: daysAgo(2), outcome: null }],
    });
    const outcome = tasks.find((t) => t.action === 'record_outcome');
    expect(outcome?.appointmentId).toBe('a1');
  });

  it('flags unconfirmed payment with an overdue day count', () => {
    const tasks = deriveCaseTasks({
      ...base,
      status: 'profile_completion',
      lastActivityAt: daysAgo(3),
      submission: { payment_confirmed: false, profile_completed_at: '2026-01-01T00:00:00Z' },
    });
    const payment = tasks[0];
    expect(payment.action).toBe('confirm_payment');
    expect(payment.values?.days).toBe(3);
  });

  it('does not ask for a passport upload (collected in profile step)', () => {
    const tasks = deriveCaseTasks({ ...base, documents: [] });
    expect(tasks.some((t) => t.action === 'upload_document')).toBe(false);
  });

  it('flags silence past the configured threshold', () => {
    const tasks = deriveCaseTasks({
      ...base,
      status: 'submitted',
      submission: { payment_confirmed: true },
      lastActivityAt: daysAgo(10),
    });
    expect(tasks.some((t) => t.action === 'add_note')).toBe(true);
  });

  it('stays quiet on terminal cases', () => {
    const tasks = deriveCaseTasks({
      ...base,
      status: 'cancelled',
      documents: [],
      lastActivityAt: daysAgo(60),
    });
    expect(tasks).toEqual([]);
  });

  it('orders the most blocking task first', () => {
    const tasks = deriveCaseTasks({
      ...base,
      status: 'profile_completion',
      documents: [],
      submission: { payment_confirmed: false, profile_completed_at: '2026-01-01T00:00:00Z' },
      lastActivityAt: daysAgo(30),
    });
    expect(tasks[0].action).toBe('confirm_payment');
    expect(tasks.length).toBeGreaterThan(1);
  });
});
