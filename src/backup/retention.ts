import { daysBetween, startOfWeek, toISODate, today } from '@/lib/dates';

import type { DriveBackup } from './drive';

const DAILY = 7;
const WEEKLY = 4;

/**
 * Which backups to delete so the folder holds the latest, the newest of each of the last 7 days and
 * the newest of each of the last 4 weeks. The newest from every other phone is kept too, so choosing
 * to keep this phone's data never deletes the other phone's last copy. `backups` must be newest first.
 */
export function backupsToPrune(backups: DriveBackup[], now: string = today()): DriveBackup[] {
  const keep = new Set<string>();
  const days = new Set<string>();
  const weeks = new Set<string>();
  const devices = new Set<string>();
  backups.forEach((b, i) => {
    if (i === 0) keep.add(b.id);
    const device = b.props.deviceId ?? '';
    if (!devices.has(device)) {
      devices.add(device);
      keep.add(b.id);
    }
    const day = toISODate(new Date(b.createdTime));
    const age = daysBetween(day, now);
    if (age < DAILY && !days.has(day)) {
      days.add(day);
      keep.add(b.id);
    }
    const week = startOfWeek(day);
    if (daysBetween(week, startOfWeek(now)) < WEEKLY * 7 && !weeks.has(week)) {
      weeks.add(week);
      keep.add(b.id);
    }
  });
  return backups.filter((b) => !keep.has(b.id));
}
