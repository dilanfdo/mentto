import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type ExactAlarmsModule = {
  canScheduleExactAlarms(): boolean;
  openSettings(): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<ExactAlarmsModule>('ExactAlarms') : null;

/** True where reminders fire on time: always off Android, and on Android when "Alarms & reminders" is allowed. */
export function canScheduleExactAlarms(): boolean {
  return native ? native.canScheduleExactAlarms() : true;
}

/** Opens Android's "Alarms & reminders" page for Mentto. */
export function openExactAlarmSettings(): void {
  native?.openSettings();
}
