import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LessonRow } from '@/components/LessonRow';
import { LessonSheet } from '@/components/LessonSheet';
import { StudentPickerSheet } from '@/components/StudentPickerSheet';
import { EmptyState, ErrorState, Fab, IconButton, Screen, SkeletonList, Text } from '@/components/ui';
import { useQuery } from '@/db/core';
import { loadLessons, type Lesson } from '@/domain/lessons';
import {
  addDays,
  eachDay,
  formatDuration,
  formatMonthYear,
  formatWeekday,
  parseDate,
  startOfWeek,
  today,
} from '@/lib/dates';
import { radii, spacing, useTheme } from '@/theme';

function DayCell({
  date,
  selected,
  isToday,
  count,
  onPress,
}: {
  date: string;
  selected: boolean;
  isToday: boolean;
  count: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const label = `${formatWeekday(date)} ${parseDate(date).getDate()}, ${
    count === 0 ? 'no lessons' : `${count} ${count === 1 ? 'lesson' : 'lessons'}`
  }${isToday ? ', today' : ''}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.day,
        selected && { backgroundColor: colors.primary },
        !selected && isToday && { borderColor: colors.primary, borderWidth: 1.5 },
      ]}
    >
      <Text variant="caption" color={selected ? 'onPrimary' : 'textSecondary'}>
        {formatWeekday(date, 'short')}
      </Text>
      <Text variant="headline" color={selected ? 'onPrimary' : 'text'}>
        {parseDate(date).getDate()}
      </Text>
      <View
        style={[
          styles.dot,
          { backgroundColor: count === 0 ? 'transparent' : selected ? colors.onPrimary : colors.primary },
        ]}
      />
    </Pressable>
  );
}

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const t = today();
  const [weekStart, setWeekStart] = useState(startOfWeek(t));
  const [selectedDate, setSelectedDate] = useState(t);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [picking, setPicking] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const { data: lessons, error, loading } = useQuery((db) => loadLessons(db, weekStart, weekEnd), [weekStart]);

  const days = eachDay(weekStart, weekEnd);
  const dayLessons = (lessons ?? []).filter((l) => l.date === selectedDate);
  const active = dayLessons.filter((l) => l.status !== 'cancelled');
  const minutes = active.reduce((sum, l) => sum + l.durationMin, 0);

  const moveWeek = (weeks: number) => {
    const next = addDays(weekStart, weeks * 7);
    setWeekStart(next);
    const offset = (parseDate(selectedDate).getDay() + 6) % 7;
    setSelectedDate(addDays(next, offset));
  };

  const goToday = () => {
    setWeekStart(startOfWeek(t));
    setSelectedDate(t);
  };

  return (
    <Screen inTabs scroll={false} hideAppBar>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text variant="display" accessibilityRole="header" style={styles.title}>
            {formatMonthYear(selectedDate)}
          </Text>
          {weekStart !== startOfWeek(t) && (
            <Pressable
              onPress={goToday}
              accessibilityRole="button"
              style={[styles.todayButton, { borderColor: colors.borderStrong }]}
            >
              <Text variant="labelStrong">Today</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.weekRow}>
          <IconButton icon="chevron-left" label="Previous week" onPress={() => moveWeek(-1)} />
          <View style={styles.days} accessibilityRole="tablist">
            {days.map((d) => (
              <DayCell
                key={d}
                date={d}
                selected={d === selectedDate}
                isToday={d === t}
                count={(lessons ?? []).filter((l) => l.date === d && l.status !== 'cancelled').length}
                onPress={() => setSelectedDate(d)}
              />
            ))}
          </View>
          <IconButton icon="chevron-right" label="Next week" onPress={() => moveWeek(1)} />
        </View>
      </View>

      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.dayHeader}>
            <Text variant="headline">{formatWeekday(selectedDate)}</Text>
            {active.length > 0 && (
              <Text variant="label" color="textSecondary">
                {active.length} {active.length === 1 ? 'lesson' : 'lessons'} · {formatDuration(minutes)}
              </Text>
            )}
          </View>
          {loading && !lessons ? (
            <SkeletonList rows={3} />
          ) : dayLessons.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-blank-outline"
              title={`Nothing on ${formatWeekday(selectedDate)}`}
              message="Lessons from your students’ weekly slots show up here."
            />
          ) : (
            <Animated.View key={selectedDate} entering={FadeIn.duration(180)} style={styles.list}>
              {dayLessons.map((lesson) => (
                <LessonRow key={lesson.key} lesson={lesson} onPress={() => setSelected(lesson)} />
              ))}
            </Animated.View>
          )}
        </ScrollView>
      )}

      <Fab icon="calendar-plus" label="Add lesson" onPress={() => setPicking(true)} />
      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
      <StudentPickerSheet
        visible={picking}
        title="Add a lesson for…"
        onClose={() => setPicking(false)}
        onPick={(owner) => {
          setPicking(false);
          router.push({ pathname: '/slot', params: owner.studentId ? { studentId: owner.studentId } : { groupId: owner.groupId! } });
        }}
        onAddStudent={() => {
          setPicking(false);
          router.push('/student/new');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  todayButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    maxWidth: 48,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 112,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.xs,
  },
});
