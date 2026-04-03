import { getNextReminderTrigger, isReminderDue } from '../reminders';

describe('reminders utils', () => {
  it('returns next-day trigger for past reminder time', () => {
    const now = new Date(2026, 1, 17, 12, 0, 0, 0);
    const target = getNextReminderTrigger('10:00', now);
    expect(target).not.toBeNull();
    expect(target!.getDate()).toBe(new Date(2026, 1, 18, 12, 0, 0, 0).getDate());
    expect(target!.getHours()).toBe(10);
  });

  it('returns same-day trigger for future reminder time', () => {
    const now = new Date(2026, 1, 17, 12, 0, 0, 0);
    const target = getNextReminderTrigger('16:30', now);
    expect(target).not.toBeNull();
    expect(target!.getDate()).toBe(new Date(2026, 1, 17, 12, 0, 0, 0).getDate());
    expect(target!.getHours()).toBe(16);
    expect(target!.getMinutes()).toBe(30);
  });

  it('validates due state and invalid times', () => {
    const now = new Date(2026, 1, 17, 12, 0, 0, 0);
    const fmt = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const current = fmt(now);
    const pastDate = new Date(now.getTime() - 60_000);
    const futureDate = new Date(now.getTime() + 60_000);
    const past = fmt(pastDate);
    const future = fmt(futureDate);

    expect(isReminderDue(past, now)).toBe(true);
    expect(isReminderDue(current, now)).toBe(true);
    expect(isReminderDue(future, now)).toBe(false);
    expect(isReminderDue('bad-time', now)).toBe(false);
    expect(getNextReminderTrigger('99:00', now)).toBeNull();
  });
});
