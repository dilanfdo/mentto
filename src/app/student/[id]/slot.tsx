import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Button,
  ChipGroup,
  DateField,
  Icon,
  Screen,
  SegmentedControl,
  SkeletonList,
  Text,
  TextField,
  TimeField,
  useSnackbar,
} from '@/components/ui';
import { useQuery } from '@/db/core';
import { endSchedule, getSchedule, listActiveSchedules, saveSchedule, type Schedule } from '@/db/schedules';
import { getStudent, type Student } from '@/db/students';
import { addMinutes, formatDuration, formatTime, today } from '@/lib/dates';
import { dayName, describeRule, WEEK_ORDER, type WeeklyRule } from '@/lib/recurrence';
import { radii, spacing, useTheme } from '@/theme';

const DURATIONS = [30, 45, 60, 90, 120];

function overlaps(a: { startTime: string; durationMin: number }, b: { startTime: string; durationMin: number }) {
  const aEnd = addMinutes(a.startTime, a.durationMin);
  const bEnd = addMinutes(b.startTime, b.durationMin);
  return a.startTime < bEnd && b.startTime < aEnd;
}

export default function SlotForm() {
  const { id, slotId } = useLocalSearchParams<{ id: string; slotId?: string }>();

  const { data, loading } = useQuery(
    async (d) => ({
      student: await getStudent(d, id),
      existing: slotId ? await getSchedule(d, slotId) : null,
      others: (await listActiveSchedules(d)).filter((s) => s.id !== slotId),
    }),
    [id, slotId],
  );

  if (loading && !data) {
    return (
      <Screen title="Weekly slot" back backIcon="close">
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (!data?.student) return null;
  return <SlotBody id={id} student={data.student} existing={data.existing} others={data.others} />;
}

type BodyProps = {
  id: string;
  student: Student;
  existing: Schedule | null;
  others: (Schedule & { studentName: string })[];
};

function SlotBody({ id, student, existing, others }: BodyProps) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { colors } = useTheme();

  const [days, setDays] = useState<number[]>(existing?.rule.days ?? []);
  const [frequency, setFrequency] = useState<'1' | '2'>(existing?.rule.interval === 2 ? '2' : '1');
  const [startTime, setStartTime] = useState(existing?.startTime ?? '16:00');
  const [duration, setDuration] = useState(existing?.durationMin ?? 60);
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? today());
  const [location, setLocation] = useState(existing?.location ?? '');
  const [error, setError] = useState<string | null>(null);

  const rule: WeeklyRule = { interval: Number(frequency), days };

  const clashes = useMemo(
    () =>
      others.filter(
        (o) => o.rule.days.some((d) => days.includes(d)) && overlaps(o, { startTime, durationMin: duration }),
      ),
    [others, days, startTime, duration],
  );

  const firstName = student.name.split(' ')[0];

  const toggleDay = (d: number) => {
    setError(null);
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  };

  const save = async () => {
    if (days.length === 0) {
      setError('Pick at least one day');
      return;
    }
    const input = { rule, startTime, durationMin: duration, startsOn, endsOn: null, location };
    const changedShape =
      existing &&
      (existing.startTime !== startTime ||
        existing.durationMin !== duration ||
        existing.rule.interval !== rule.interval ||
        [...existing.rule.days].sort().join() !== [...days].sort().join());

    if (existing && changedShape && existing.startsOn < today()) {
      // Keep past lessons as they were: end the old slot and start the new pattern from today.
      await endSchedule(db, existing);
      await saveSchedule(db, id, { ...input, startsOn: startsOn < today() ? today() : startsOn });
    } else {
      await saveSchedule(db, id, input, existing?.id);
    }
    router.back();
    snackbar(existing ? 'Slot updated' : `Slot added: ${describeRule(rule)}, ${formatTime(startTime)}`, {
      icon: 'calendar-check-outline',
    });
  };

  const stop = () => {
    if (!existing) return;
    Alert.alert('Stop this slot?', 'No more lessons will be scheduled from it. Past lessons and attendance are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop slot',
        style: 'destructive',
        onPress: async () => {
          await endSchedule(db, existing);
          router.back();
          snackbar('Slot stopped', { icon: 'calendar-remove' });
        },
      },
    ]);
  };

  return (
    <Screen
      title={existing ? 'Edit weekly slot' : `Weekly slot for ${firstName}`}
      back
      backIcon="close"
      footer={<Button label={existing ? 'Save slot' : 'Add slot'} onPress={save} fullWidth />}
      contentStyle={styles.content}
    >
      <View style={styles.group}>
        <Text variant="labelStrong" color="textSecondary">
          Days
        </Text>
        <ChipGroup
          options={WEEK_ORDER.map((d) => ({ value: d, label: dayName(d), accessibilityLabel: dayName(d, 'long') }))}
          value={days}
          onChange={toggleDay}
        />
        {error && (
          <View style={styles.inline} accessibilityLiveRegion="polite">
            <Icon name="alert-circle-outline" size={16} color="danger" />
            <Text variant="caption" color="danger">
              {error}
            </Text>
          </View>
        )}
      </View>

      <SegmentedControl
        options={[
          { value: '1', label: 'Every week' },
          { value: '2', label: 'Every other week' },
        ]}
        value={frequency}
        onChange={setFrequency}
      />

      <TimeField label="Start time" value={startTime} onChange={setStartTime} />

      <View style={styles.group}>
        <Text variant="labelStrong" color="textSecondary">
          Length
        </Text>
        <ChipGroup
          options={[...new Set([...DURATIONS, duration])]
            .sort((a, b) => a - b)
            .map((m) => ({ value: m, label: formatDuration(m) }))}
          value={duration}
          onChange={setDuration}
        />
      </View>

      {clashes.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[styles.warning, { backgroundColor: colors.warningSoft }]}
          accessibilityLiveRegion="polite"
        >
          <Icon name="alert-outline" size={20} color="onWarningSoft" />
          <Text variant="label" color="onWarningSoft" style={styles.flex}>
            Overlaps with{' '}
            {clashes
              .slice(0, 2)
              .map((c) => `${c.studentName} (${describeRule(c.rule)}, ${formatTime(c.startTime)})`)
              .join(' and ')}
            . You can still save it.
          </Text>
        </Animated.View>
      )}

      <DateField
        label="Starting from"
        value={startsOn}
        onChange={setStartsOn}
        hint={existing && existing.startsOn < today() ? 'Changes to days or time apply from today on.' : undefined}
      />

      <TextField
        label="Location"
        optional
        value={location}
        onChangeText={setLocation}
        placeholder="Studio, online, student’s home…"
      />

      {existing && (
        <Button label="Stop this slot" icon="calendar-remove" variant="danger" onPress={stop} style={styles.stop} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  warning: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  flex: {
    flex: 1,
  },
  stop: {
    marginTop: spacing.sm,
  },
});
