import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform } from 'react-native';

import { clearException, markLesson, setException } from '@/db/schedules';
import { canMarkAttendance, type Lesson } from '@/domain/lessons';
import {
  formatLongDate,
  formatRelativeDay,
  formatTimeRange,
  joinDateTime,
  toDate,
  toISODate,
  toISOTime,
} from '@/lib/dates';

import { ListRow, Sheet, useSnackbar } from './ui';

type Props = {
  lesson: Lesson | null;
  onClose: () => void;
  /** Hide "View student" when already on the student's page. */
  fromStudent?: boolean;
};

/** Actions for one lesson: attendance, cancel or restore, move, and a link to the student. */
export function LessonSheet({ lesson: current, onClose, fromStudent }: Props) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  // Keep showing the last lesson while the sheet animates closed.
  const [lesson, setLesson] = useState(current);
  if (current && current !== lesson) setLesson(current);

  const visible = current !== null;
  if (!lesson) return null;

  const target = {
    studentId: lesson.studentId,
    scheduleId: lesson.scheduleId,
    startsAt: lesson.startsAt,
    durationMin: lesson.durationMin,
  };
  const previous = lesson.status === 'attended' || lesson.status === 'missed' ? lesson.status : null;

  const mark = async (status: 'attended' | 'missed' | null) => {
    onClose();
    await markLesson(db, target, status);
    snackbar(
      status === 'attended' ? 'Marked as attended' : status === 'missed' ? 'Marked as missed' : 'Attendance cleared',
      {
        icon: status === 'attended' ? 'check-circle-outline' : 'information-outline',
        action: { label: 'Undo', onPress: () => markLesson(db, target, previous) },
      },
    );
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
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const newDate = toISODate(date);
        DateTimePickerAndroid.open({
          value: toDate(lesson.date, lesson.startTime),
          mode: 'time',
          minuteInterval: 5,
          onChange: async (e, time) => {
            if (e.type !== 'set' || !time) return;
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

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={lesson.studentName}
      subtitle={`${formatLongDate(lesson.date)} · ${formatTimeRange(lesson.startTime, lesson.durationMin)}`}
    >
      {lesson.status === 'cancelled' ? (
        <ListRow leadingIcon="restore" title="Restore this lesson" subtitle="Put it back on the schedule" onPress={restore} />
      ) : (
        <>
          {markable && lesson.status !== 'attended' && (
            <ListRow leadingIcon="check-circle-outline" title="Mark attended" onPress={() => mark('attended')} />
          )}
          {markable && lesson.status !== 'missed' && (
            <ListRow
              leadingIcon="close-circle-outline"
              title="Mark missed"
              subtitle="The student didn’t turn up"
              onPress={() => mark('missed')}
            />
          )}
          {previous && <ListRow leadingIcon="undo-variant" title="Clear attendance" onPress={() => mark(null)} />}
          {!previous && Platform.OS === 'android' && (
            <ListRow
              leadingIcon="calendar-edit"
              title="Move this lesson"
              subtitle="Only this one; the weekly slot stays the same"
              onPress={reschedule}
            />
          )}
          {lesson.moved && !previous && (
            <ListRow leadingIcon="restore" title="Back to the usual time" onPress={restore} />
          )}
          {!previous && (
            <ListRow
              leadingIcon="calendar-remove"
              title="Cancel this lesson"
              subtitle="Only this one; not charged on per-lesson plans"
              onPress={cancel}
            />
          )}
        </>
      )}
      {!fromStudent && (
        <ListRow
          leadingIcon="account-outline"
          title="View student"
          chevron
          onPress={() => {
            onClose();
            router.push({ pathname: '/student/[id]', params: { id: lesson.studentId } });
          }}
        />
      )}
    </Sheet>
  );
}
