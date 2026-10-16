import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { clearException, markLesson, setException } from '@/db/schedules';
import { canMarkAttendance, type Lesson, type MemberStatus } from '@/domain/lessons';
import {
  formatLongDate,
  formatRelativeDay,
  formatTimeRange,
  joinDateTime,
  toDate,
  toISODate,
  toISOTime,
} from '@/lib/dates';
import { radii, spacing, useTheme } from '@/theme';

import { Avatar, Divider, Icon, ListRow, Sheet, Text, useSnackbar } from './ui';

type Props = {
  lesson: Lesson | null;
  onClose: () => void;
  /** The student or group whose page this is, so the sheet doesn't link back to it. */
  ownerId?: string;
};

function MarkButton({
  label,
  selected,
  tone,
  onPress,
}: {
  label: string;
  selected: boolean;
  tone: 'success' | 'danger';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const bg = selected ? (tone === 'success' ? colors.successSoft : colors.dangerSoft) : colors.surface;
  const fg = selected ? (tone === 'success' ? 'onSuccessSoft' : 'onDangerSoft') : 'textSecondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      style={[styles.mark, { backgroundColor: bg, borderColor: selected ? 'transparent' : colors.border }]}
    >
      {selected && <Icon name={tone === 'success' ? 'check' : 'close'} size={14} color={fg} />}
      <Text variant="labelStrong" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Actions for one lesson: attendance (per member for groups), cancel or restore, move, and links. */
export function LessonSheet({ lesson: current, onClose, ownerId }: Props) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  // Keep showing the last lesson while the sheet animates closed.
  const [lesson, setLesson] = useState(current);
  // Group attendance updates in place while the sheet stays open.
  const [marks, setMarks] = useState<Record<string, MemberStatus>>({});
  if (current && current !== lesson) {
    setLesson(current);
    setMarks(Object.fromEntries(current.members.map((m) => [m.studentId, m.status])));
  }

  const visible = current !== null;
  if (!lesson) return null;

  const isGroup = !!lesson.groupId;
  const target = (studentId: string) => ({
    studentId,
    scheduleId: lesson.scheduleId,
    startsAt: lesson.startsAt,
    durationMin: lesson.durationMin,
  });
  // Decided from the state when the sheet opened, so marking students doesn't add or remove rows
  // and shift the sheet under the tutor's finger.
  const anyMarked = lesson.members.some((m) => m.status !== 'upcoming');
  const previous = lesson.status === 'attended' || lesson.status === 'missed' ? lesson.status : null;

  // One-to-one lessons: mark, close and offer undo.
  const markSolo = async (status: 'attended' | 'missed' | null) => {
    const t = target(lesson.studentId!);
    onClose();
    await markLesson(db, t, status);
    snackbar(
      status === 'attended' ? 'Marked as attended' : status === 'missed' ? 'Marked as missed' : 'Attendance cleared',
      {
        icon: status === 'attended' ? 'check-circle-outline' : 'information-outline',
        action: { label: 'Undo', onPress: () => markLesson(db, t, previous) },
      },
    );
  };

  // Group lessons: each tap saves straight away; tapping the selected mark clears it.
  const markMember = async (studentId: string, status: 'attended' | 'missed') => {
    const next = marks[studentId] === status ? null : status;
    setMarks((m) => ({ ...m, [studentId]: next ?? 'upcoming' }));
    await markLesson(db, target(studentId), next);
  };

  const markEveryone = async () => {
    const pending = lesson.members.filter((m) => marks[m.studentId] !== 'attended');
    setMarks(Object.fromEntries(lesson.members.map((m) => [m.studentId, 'attended'])));
    for (const m of pending) await markLesson(db, target(m.studentId), 'attended');
    snackbar(`Marked ${lesson.members.length} as attended`, { icon: 'check-circle-outline' });
  };

  const cancel = async () => {
    onClose();
    await setException(db, lesson.scheduleId, lesson.originalDate, 'cancelled');
    snackbar('Lesson cancelled', {
      icon: 'calendar-remove',
      action: { label: 'Undo', onPress: () => clearException(db, lesson.scheduleId, lesson.originalDate) },
    });
  };

  const restore = async () => {
    onClose();
    await clearException(db, lesson.scheduleId, lesson.originalDate);
    snackbar('Lesson restored to its usual time', { icon: 'restore' });
  };

  const reschedule = () => {
    if (Platform.OS !== 'android') return;
    onClose();
    DateTimePickerAndroid.open({
      value: toDate(lesson.date, lesson.startTime),
      mode: 'date',
      onValueChange: (_event, date) => {
        const newDate = toISODate(date);
        DateTimePickerAndroid.open({
          value: toDate(lesson.date, lesson.startTime),
          mode: 'time',
          minuteInterval: 5,
          onValueChange: async (_e, time) => {
            const startsAt = joinDateTime(newDate, toISOTime(time));
            if (startsAt === joinDateTime(lesson.originalDate, lesson.startTime) && !lesson.moved) return;
            await setException(db, lesson.scheduleId, lesson.originalDate, 'moved', startsAt);
            snackbar(`Moved to ${formatRelativeDay(newDate)}, ${formatTimeRange(toISOTime(time), lesson.durationMin)}`, {
              icon: 'calendar-edit',
              action: { label: 'Undo', onPress: () => clearException(db, lesson.scheduleId, lesson.originalDate) },
            });
          },
        });
      },
    });
  };

  const markable = canMarkAttendance(lesson);
  const hasMarks = isGroup ? anyMarked : !!previous;
  const showOwnerLink = ownerId !== lesson.studentId && ownerId !== lesson.groupId;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={lesson.title}
      subtitle={`${formatLongDate(lesson.date)} · ${formatTimeRange(lesson.startTime, lesson.durationMin)}`}
    >
      {lesson.status === 'cancelled' ? (
        <ListRow leadingIcon="restore" title="Restore this lesson" subtitle="Put it back on the schedule" onPress={restore} />
      ) : (
        <>
          {isGroup && markable && (
            <>
              {lesson.members.length === 0 ? (
                <ListRow leadingIcon="account-group-outline" title="No students in this group yet" />
              ) : (
                <ScrollView
                  style={styles.memberScroll}
                  contentContainerStyle={styles.members}
                  accessibilityLabel="Attendance"
                >
                  {lesson.members.map((m) => (
                    <View key={m.studentId} style={styles.member}>
                      <Avatar name={m.name} size={32} />
                      <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                        {m.name}
                      </Text>
                      <MarkButton
                        label="Came"
                        tone="success"
                        selected={marks[m.studentId] === 'attended'}
                        onPress={() => markMember(m.studentId, 'attended')}
                      />
                      <MarkButton
                        label="Missed"
                        tone="danger"
                        selected={marks[m.studentId] === 'missed'}
                        onPress={() => markMember(m.studentId, 'missed')}
                      />
                    </View>
                  ))}
                </ScrollView>
              )}
              {lesson.members.length > 0 && (
                <ListRow
                  leadingIcon="check-all"
                  title="Everyone came"
                  dimmed={lesson.members.every((m) => marks[m.studentId] === 'attended')}
                  onPress={markEveryone}
                />
              )}
              <Divider />
            </>
          )}

          {!isGroup && markable && lesson.status !== 'attended' && (
            <ListRow leadingIcon="check-circle-outline" title="Mark attended" onPress={() => markSolo('attended')} />
          )}
          {!isGroup && markable && lesson.status !== 'missed' && (
            <ListRow
              leadingIcon="close-circle-outline"
              title="Mark missed"
              subtitle="The student didn’t turn up"
              onPress={() => markSolo('missed')}
            />
          )}
          {!isGroup && previous && (
            <ListRow leadingIcon="undo-variant" title="Clear attendance" onPress={() => markSolo(null)} />
          )}

          {!hasMarks && Platform.OS === 'android' && (
            <ListRow
              leadingIcon="calendar-edit"
              title="Move this lesson"
              subtitle={lesson.once ? 'Pick a new day and time' : 'Only this one; the weekly slot stays the same'}
              onPress={reschedule}
            />
          )}
          {lesson.moved && !hasMarks && <ListRow leadingIcon="restore" title="Back to the usual time" onPress={restore} />}
          {!hasMarks && (
            <ListRow
              leadingIcon="calendar-remove"
              title="Cancel this lesson"
              subtitle={lesson.once ? 'Keeps it on record as cancelled' : 'Only this one; not charged on per-lesson plans'}
              onPress={cancel}
            />
          )}
          {lesson.once && (
            <ListRow
              leadingIcon="pencil-outline"
              title="Edit lesson"
              chevron
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/slot',
                  params: lesson.groupId
                    ? { groupId: lesson.groupId, slotId: lesson.scheduleId }
                    : { studentId: lesson.studentId!, slotId: lesson.scheduleId },
                });
              }}
            />
          )}
        </>
      )}
      {showOwnerLink && (
        <ListRow
          leadingIcon={isGroup ? 'account-group-outline' : 'account-outline'}
          title={isGroup ? 'View group' : 'View student'}
          chevron
          onPress={() => {
            onClose();
            if (lesson.groupId) router.push({ pathname: '/group/[id]', params: { id: lesson.groupId } });
            else router.push({ pathname: '/student/[id]', params: { id: lesson.studentId! } });
          }}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  memberScroll: {
    flexGrow: 0,
    maxHeight: 300,
  },
  members: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
  mark: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
