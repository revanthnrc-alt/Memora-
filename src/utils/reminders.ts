export const getNextReminderTrigger = (time: string, now = new Date()): Date | null => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
};

export const isReminderDue = (time: string, now = new Date()): boolean => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return false;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  return now.getTime() >= target.getTime();
};
