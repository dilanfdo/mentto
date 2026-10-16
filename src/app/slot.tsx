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
import { getGroup } from '@/db/groups';
import {
  deleteSchedule,
  endSchedule,
  getSchedule,
  listActiveSchedules,
  saveSchedule,
  type Schedule,
  type SlotOwner,
} from '@/db/schedules';
import { getStudent } from '@/db/students';
import {
  addMinutes,
  formatDuration,
  formatRelativeDay,
  formatShortDate,
  formatTime,
  today,
  weekday,
} from '@/lib/dates';
import { dayName, describeRule, occursOn, ONCE, WEEK_ORDER, type WeeklyRule } from '@/lib/recurrence';
import { radii, spacing, useTheme } from '@/theme';

const DURATIONS = [30, 45, 60, 90, 120];

type Mode = 'weekly' | 'once';
type Other = Schedule & { ownerName: string };

function overlaps(a: { startTime: string; durationMin: number }, b: { startTime: string; durationMin: number }) {
  const aEnd = addMinutes(a.startTime, a.durationMin);
  const bEnd = addMinutes(b.startTime, b.durationMin);
  return a.startTime < bEnd && b.startTime < aEnd;
}

/**
 * Adds or edits a lesson time for a student or a group: a weekly slot, or a one-off lesson.
 * Params: `studentId` or `groupId`, optional `slotId` to edit, optional `mode=once`.
 */
export default function SlotForm() {
  const { studentId, groupId, slotId, mode } = useLocalSearchParams<{
    studentId?: string;
    groupId?: string;
    slotId?: string;
    mode?: Mode;
  }>();

  const { data, loading } = useQuery(
    async (d) => {
      const name = studentId ? (await getStudent(d, studentId))?.name : groupId ? (await getGroup(d, groupId))?.name : null;
      return {
        name: name ?? null,
        existing: slotId ? await getSchedule(d, slotId) : null,
        others: (await listActiveSchedules(d)).filter((s) => s.id !== slotId),
      };
    },
    [studentId, groupId, slotId],
  );

  if (loading && !data) {
    return (
      <Screen title="Lesson time" back backIcon="close">
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (!data?.name) return null;
  const owner: SlotOwner = studentId ? { studentId } : { groupId: groupId! };
  return (
    <SlotBody
      owner={owner}
      ownerName={data.name}
      existing={data.existing}
      others={data.others}
      initialMode={data.existing ? (data.existing.rule.once ? 'once' : 'weekly') : mode === 'once' ? 'once' : 'weekly'}
    />
  );
}

type BodyProps = {
  owner: SlotOwner;
  ownerName: string;
  existing: Schedule | null;
  others: Other[];
  initialMode: Mode;
};

function SlotBody({ owner, ownerName, existing, others, initialMode }: BodyProps) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { colors } = useTheme();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [days, setDays] = useState<number[]>(existing?.rule.days ?? []);
  const [frequency, setFrequency] = useState<'1' | '2'>(existing?.rule.interval === 2 ? '2' : '1');
  const [startTime, setStartTime] = useState(existing?.startTime ?? '16:00');
  const [duration, setDuration] = useState(existing?.durationMin ?? 60);
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? today());
  const [location, setLocation] = useState(existing?.location ?? '');
  const [error, setError] = useState<string | null>(null);

  const once = mode === 'once';
  const rule: WeeklyRule = once ? ONCE : { interval: Number(frequency), days };
  const shortName = owner.studentId ? ownerName.split(' ')[0] : ownerName;

  const clashes = useMemo(() => {
    const time = { startTime, durationMin: duration };
    return others.filter((o) => {
      if (!overlaps(o, time)) return false;
      if (once) return occursOn(o.rule, o.startsOn, o.endsOn, startsOn);
      if (o.rule.once) return o.startsOn >= today() && days.includes(weekday(o.startsOn));
      return o.rule.days.some((d) => days.includes(d));
    });
  }, [others, once, days, startTime, duration, startsOn]);

  const toggleDay = (d: number) => {
    setError(null);
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  };

  const save = async () => {
    if (!once && days.length === 0) {
      setError('Pick at least one day');
      return;
    }
    const input = { rule, startTime, durationMin: duration, startsOn, endsOn: null, location };
    const changedShape =
      existing &&
      !once &&
      (existing.startTime !== startTime ||
        existing.durationMin !== duration ||
        existing.rule.interval !== rule.interval ||
        [...existing.rule.days].sort().join() !== [...days].sort().join());

    if (existing && changedShape && existing.startsOn < today()) {
      // Keep past lessons as they were: end the old slot and start the new pattern from today.
      await endSchedule(db, existing);
      await saveSchedule(db, owner, { ...input, startsOn: startsOn < today() ? today() : startsOn });
    } else {
      await saveSchedule(db, owner, input, existing?.id);
    }
    router.back();
    snackbar(
      existing
        ? once
          ? 'Lesson updated'
          : 'Slot updated'
        : once
          ? `Lesson added: ${formatRelativeDay(startsOn)}, ${formatTime(startTime)}`
          : `Slot added: ${describeRule(rule)}, ${formatTime(startTime)}`,
      { icon: 'calendar-check-outline' },
    );
  };

  const remove = () => {
    if (!existing) return;
    if (existing.rule.once) {
      Alert.alert('Delete this lesson?', 'It’s removed from the schedule, along with any attendance marked for it.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSchedule(db, existing.id);
            router.back();
            snackbar('Lesson deleted', { icon: 'delete-outline' });
          },
        },
      ]);
      return;
    }
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

  const title = existing
    ? once
      ? 'Edit lesson'
      : 'Edit weekly slot'
    : once
      ? `Extra lesson for ${shortName}`
      : `Weekly slot for ${shortName}`;

  return (
    <Screen
      title={title}
      back
      backIcon="close"
      footer={
        <Button
          label={existing ? (once ? 'Save lesson' : 'Save slot') : once ? 'Add lesson' : 'Add slot'}
          onPress={save}
          fullWidth
        />
      }
      contentStyle={styles.content}
    >
      {!existing && (
        <SegmentedControl
          options={[
            { value: 'weekly', label: 'Every week' },
            { value: 'once', label: 'Just once' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
        />
      )}

      {once ? (
        <DateField label="Date" value={startsOn} onChange={setStartsOn} />
      ) : (
        <>
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
              { value: '1', label: 'Weekly' },
              { value: '2', label: 'Every other week' },
            ]}
            value={frequency}
            onChange={setFrequency}
          />
        </>
      )}

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
              .map(
                (c) =>
                  `${c.ownerName} (${c.rule.once ? formatShortDate(c.startsOn) : describeRule(c.rule)}, ${formatTime(c.startTime)})`,
              )
              .join(' and ')}
            . You can still save it.
          </Text>
        </Animated.View>
      )}

      {!once && (
        <DateField
          label="Starting from"
          value={startsOn}
          onChange={setStartsOn}
          hint={existing && existing.startsOn < today() ? 'Changes to days or time apply from today on.' : undefined}
        />
      )}

      <TextField
        label="Location"
        optional
        value={location}
        onChangeText={setLocation}
        placeholder={owner.groupId ? 'Studio, hall, online…' : 'Studio, online, student’s home…'}
      />

      {existing && (
        <Button
          label={existing.rule.once ? 'Delete this lesson' : 'Stop this slot'}
          icon={existing.rule.once ? 'delete-outline' : 'calendar-remove'}
          variant="danger"
          onPress={remove}
          style={styles.stop}
        />
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
