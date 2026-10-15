import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  formatRelativeDay,
  formatShortDate,
  formatTime,
  toDate,
  toISODate,
  toISOTime,
  today,
  type ISODate,
  type ISOTime,
} from '@/lib/dates';
import { radii, sizes, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type BaseProps = {
  label: string;
  display: string;
  icon: IconName;
  onPress: () => void;
  hint?: string;
};

function FieldButton({ label, display, icon, onPress, hint }: BaseProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="labelStrong" color="textSecondary">
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        accessibilityHint="Opens a picker"
        android_ripple={{ color: colors.ripple }}
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Icon name={icon} size={20} color="textTertiary" />
        <Text variant="body" style={styles.value}>
          {display}
        </Text>
        <Icon name="chevron-down" size={20} color="textTertiary" />
      </Pressable>
      {hint && (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      )}
    </View>
  );
}

type DateProps = {
  label: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
  minimumDate?: ISODate;
  maximumDate?: ISODate;
  hint?: string;
};

export function DateField({ label, value, onChange, minimumDate, maximumDate, hint }: DateProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'date',
        minimumDate: minimumDate ? toDate(minimumDate) : undefined,
        maximumDate: maximumDate ? toDate(maximumDate) : undefined,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toISODate(date));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };
  const relative = formatRelativeDay(value);
  const display = ['Today', 'Tomorrow', 'Yesterday'].includes(relative)
    ? `${relative}, ${formatShortDate(value)}`
    : formatShortDate(value, today());
  return (
    <>
      <FieldButton label={label} display={display} icon="calendar-blank-outline" onPress={open} hint={hint} />
      {iosOpen && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="inline"
          onChange={(_, date) => date && onChange(toISODate(date))}
        />
      )}
    </>
  );
}

type TimeProps = {
  label: string;
  value: ISOTime;
  onChange: (value: ISOTime) => void;
  hint?: string;
};

export function TimeField({ label, value, onChange, hint }: TimeProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(today(), value),
        mode: 'time',
        minuteInterval: 5,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toISOTime(date));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };
  return (
    <>
      <FieldButton label={label} display={formatTime(value)} icon="clock-outline" onPress={open} hint={hint} />
      {iosOpen && (
        <DateTimePicker
          value={toDate(today(), value)}
          mode="time"
          display="spinner"
          minuteInterval={5}
          onChange={(_, date) => date && onChange(toISOTime(date))}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  field: {
    minHeight: sizes.input,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  value: {
    flex: 1,
  },
});
