import { Pressable, StyleSheet, View } from 'react-native';

import { attendedCount, type Lesson } from '@/domain/lessons';
import {
  formatDuration,
  formatShortDate,
  formatTime,
  formatWeekday,
  joinDateTime,
  toDate,
  toISODate,
  toISOTime,
} from '@/lib/dates';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';

import { Badge, Text } from './ui';

type Props = {
  lesson: Lesson;
  onPress: () => void;
  /** Show the day as well as the time, for lists that span several days. */
  showDate?: boolean;
  hideName?: boolean;
};

function inProgress(lesson: Lesson): boolean {
  const now = new Date();
  const stamp = joinDateTime(toISODate(now), toISOTime(now));
  const end = new Date(toDate(lesson.date, lesson.startTime).getTime() + lesson.durationMin * 60_000);
  return lesson.status === 'upcoming' && lesson.startsAt <= stamp && now < end;
}

export function LessonRow({ lesson, onPress, showDate, hideName }: Props) {
  const { colors } = useTheme();
  const live = inProgress(lesson);
  const accent: keyof ColorTokens =
    lesson.status === 'attended'
      ? 'success'
      : lesson.status === 'missed'
        ? 'danger'
        : lesson.status === 'cancelled'
          ? 'borderStrong'
          : 'primary';

  const isGroup = !!lesson.groupId;
  // On a student's own page a group lesson is named by its group; elsewhere by its size.
  const groupDetail = isGroup ? (hideName ? lesson.title : `${lesson.members.length} students`) : null;
  const details = [
    showDate && !hideName ? `${formatWeekday(lesson.date, 'short')} ${formatShortDate(lesson.date)}` : null,
    groupDetail,
    lesson.once ? 'One-off' : null,
    formatDuration(lesson.durationMin),
    lesson.location,
    lesson.moved ? `Moved from ${formatShortDate(lesson.originalDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Group lessons on the shared schedule show a head count rather than one person's status.
  const showCount = isGroup && !hideName && lesson.status !== 'cancelled';
  const came = attendedCount(lesson);
  const marked = lesson.members.filter((m) => m.status !== 'upcoming').length;
  const statusLabel =
    showCount && marked > 0
      ? `${came}/${lesson.members.length} came`
      : lesson.status === 'attended'
      ? 'Attended'
      : lesson.status === 'missed'
        ? 'Missed'
        : lesson.status === 'cancelled'
          ? 'Cancelled'
          : live
            ? 'Now'
            : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        hideName ? null : lesson.title,
        formatTime(lesson.startTime),
        details,
        statusLabel,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Opens lesson actions"
      android_ripple={{ color: colors.ripple }}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.bar, { backgroundColor: colors[accent] }]} />
      <View style={styles.time}>
        <Text variant="bodyStrong" color={lesson.status === 'cancelled' ? 'textTertiary' : 'text'}>
          {formatTime(lesson.startTime)}
        </Text>
      </View>
      <View style={styles.main}>
        <Text
          variant="bodyStrong"
          numberOfLines={1}
          color={lesson.status === 'cancelled' ? 'textTertiary' : 'text'}
          style={lesson.status === 'cancelled' && styles.struck}
        >
          {hideName ? `${formatWeekday(lesson.date, 'short')}, ${formatShortDate(lesson.date)}` : lesson.title}
        </Text>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {details}
        </Text>
      </View>
      {statusLabel && (
        <Badge
          label={statusLabel}
          tone={
            lesson.status === 'attended'
              ? 'success'
              : lesson.status === 'missed'
                ? 'danger'
                : lesson.status === 'cancelled'
                  ? 'neutral'
                  : 'primary'
          }
          icon={
            showCount && marked > 0
              ? 'account-check-outline'
              : lesson.status === 'attended'
              ? 'check'
              : lesson.status === 'missed'
                ? 'close'
                : lesson.status === 'cancelled'
                  ? 'cancel'
                  : 'circle-medium'
          }
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
  },
  time: {
    minWidth: 72,
    paddingLeft: spacing.xs,
  },
  main: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
