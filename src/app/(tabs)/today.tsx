import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LessonRow } from '@/components/LessonRow';
import { LessonSheet } from '@/components/LessonSheet';
import { StatTile } from '@/components/StatTile';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Section,
  SkeletonList,
  Text,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { getSettings, saveSettings } from '@/db/settings';
import { loadAllFeeStatuses, type FeeStatus } from '@/domain/fees';
import { loadLessons, loadNextLesson, type Lesson } from '@/domain/lessons';
import {
  addDays,
  formatLongDate,
  formatRelativeDay,
  formatRelativeDayInline,
  formatShortDate,
  formatTime,
  greeting,
  today,
} from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useReminderAccess } from '@/notifications/useReminderAccess';
import { spacing } from '@/theme';
import { openExactAlarmSettings } from '@modules/exact-alarms';

async function loadToday(db: DB) {
  const settings = await getSettings(db);
  const t = today();
  const [lessons, statuses, students] = await Promise.all([
    loadLessons(db, t, t),
    loadAllFeeStatuses(db, settings.currency),
    db.getAllAsync<{ id: string; name: string }>(`SELECT id, name FROM students WHERE status = 'active'`),
  ]);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const all = [...statuses.values()];
  const owing = all
    .filter((s) => s.balance > 0)
    .sort((a, b) => (a.unpaidSince ?? '').localeCompare(b.unpaidSince ?? ''));
  const soon = all
    .filter((s) => s.balance <= 0 && s.nextDue && s.nextDue.date <= addDays(t, 3))
    .sort((a, b) => a.nextDue!.date.localeCompare(b.nextDue!.date));
  const remaining = lessons.filter((l) => l.status === 'upcoming');
  const next = remaining.length === 0 && students.length > 0 ? await loadNextLesson(db) : null;
  return { settings, lessons, owing, soon, names, studentCount: students.length, next };
}

function owingLabel(s: FeeStatus): string {
  if (!s.unpaidSince) return 'Balance due';
  const t = today();
  if (s.unpaidSince === t) return 'Due today';
  return `Overdue since ${formatShortDate(s.unpaidSince)}`;
}

function dueLabel(date: string): string {
  const rel = formatRelativeDay(date);
  return `Due ${rel === 'Today' || rel === 'Tomorrow' ? rel.toLowerCase() : rel}`;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const access = useReminderAccess();
  const { data, error, loading } = useQuery(loadToday, []);
  const [selected, setSelected] = useState<Lesson | null>(null);

  const settingsButton = (
    <IconButton icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
  );

  if (error) {
    return (
      <Screen inTabs actions={settingsButton}>
        <ErrorState message={error.message} />
      </Screen>
    );
  }

  const name = data?.settings.tutorName.split(' ')[0];
  // Marked either way (came or missed) means the lesson is behind you.
  const done = data?.lessons.filter((l) => l.status === 'attended' || l.status === 'missed').length ?? 0;
  const active = data?.lessons.filter((l) => l.status !== 'cancelled').length ?? 0;
  const owingTotal = data?.owing.reduce((sum, s) => sum + s.balance, 0) ?? 0;
  const currency = data?.settings.currency ?? 'USD';

  return (
    <Screen inTabs actions={settingsButton} title="">
      <View style={styles.hero}>
        <Text variant="label" color="textSecondary">
          {greeting()}
          {name ? `, ${name}` : ''}
        </Text>
        <Text variant="display" accessibilityRole="header">
          {formatLongDate(today())}
        </Text>
      </View>

      {loading && !data ? (
        <SkeletonList rows={4} />
      ) : data && data.studentCount === 0 ? (
        <Card style={styles.welcome}>
          <EmptyState
            icon="account-plus-outline"
            title="Add your first student"
            message="Then give them a weekly time slot and a fee plan. Mentto takes it from there."
            action={<Button label="Add student" icon="plus" onPress={() => router.push('/student/new')} />}
          />
        </Card>
      ) : data ? (
        <>
          <View style={styles.tiles}>
            <StatTile
              icon="calendar-blank-outline"
              label="Lessons today"
              value={String(active)}
              caption={active === 0 ? 'A free day' : `${done} done · ${active - done} to go`}
              onPress={() => router.push('/schedule')}
            />
            <StatTile
              icon="wallet-outline"
              label="To collect"
              value={formatMoney(owingTotal, currency)}
              caption={
                data.owing.length === 0
                  ? 'All paid up'
                  : `${data.owing.length} ${data.owing.length === 1 ? 'student' : 'students'}`
              }
              onPress={() => router.push('/fees')}
            />
          </View>

          {access.notifications === 'granted' && !access.exact && !data.settings.exactHintDismissed && (
            <Card style={styles.hint}>
              <View style={styles.hintRow}>
                <Icon name="clock-alert-outline" color="primary" />
                <View style={styles.hintText}>
                  <Text variant="bodyStrong">Get reminders on time</Text>
                  <Text variant="label" color="textSecondary">
                    Android can hold reminders back by up to an hour. Allow “Alarms & reminders” for Mentto so they
                    arrive right on time.
                  </Text>
                </View>
              </View>
              <View style={styles.hintActions}>
                <Button
                  label="Not now"
                  variant="ghost"
                  size="small"
                  onPress={() => saveSettings(db, { exactHintDismissed: true })}
                />
                <Button label="Allow" size="small" onPress={openExactAlarmSettings} />
              </View>
            </Card>
          )}

          <Section title="Today’s lessons" action={{ label: 'Schedule', onPress: () => router.push('/schedule') }}>
            {data.lessons.length === 0 ? (
              <Card>
                <View style={styles.inlineEmpty}>
                  <Text variant="bodyStrong">No lessons today</Text>
                  <Text variant="label" color="textSecondary">
                    {data.next
                      ? `Next: ${data.next.title}, ${formatRelativeDayInline(data.next.date)} at ${formatTime(data.next.startTime)}`
                      : 'Give a student a weekly time slot to see lessons here.'}
                  </Text>
                </View>
              </Card>
            ) : (
              <View style={styles.list}>
                {data.lessons.map((lesson) => (
                  <LessonRow key={lesson.key} lesson={lesson} onPress={() => setSelected(lesson)} />
                ))}
                {data.next && (
                  <Text variant="label" color="textSecondary" style={styles.nextLine}>
                    Next: {data.next.title}, {formatRelativeDayInline(data.next.date)} at{' '}
                    {formatTime(data.next.startTime)}
                  </Text>
                )}
              </View>
            )}
          </Section>

          {(data.owing.length > 0 || data.soon.length > 0) && (
            <Section title="Fees" action={{ label: 'See all', onPress: () => router.push('/fees') }}>
              <Card padded={false}>
                {data.owing.slice(0, 5).map((s, i) => (
                  <View key={s.studentId}>
                    {i > 0 && <Divider inset={68} />}
                    <ListRow
                      title={data.names.get(s.studentId) ?? 'Student'}
                      subtitle={owingLabel(s)}
                      leading={<Avatar name={data.names.get(s.studentId) ?? '?'} size={40} />}
                      trailing={<Badge label={formatMoney(s.balance, s.currency)} tone="warning" />}
                      accessibilityHint="Record a payment"
                      onPress={() =>
                        router.push({ pathname: '/student/[id]/payment', params: { id: s.studentId } })
                      }
                    />
                  </View>
                ))}
                {data.soon.map((s, i) => (
                  <View key={s.studentId}>
                    {(i > 0 || data.owing.length > 0) && <Divider inset={68} />}
                    <ListRow
                      title={data.names.get(s.studentId) ?? 'Student'}
                      subtitle={dueLabel(s.nextDue!.date)}
                      leading={<Avatar name={data.names.get(s.studentId) ?? '?'} size={40} />}
                      trailing={<Badge label={formatMoney(s.nextDue!.amount, s.currency)} tone="neutral" />}
                      onPress={() => router.push({ pathname: '/student/[id]', params: { id: s.studentId } })}
                    />
                  </View>
                ))}
              </Card>
            </Section>
          )}
        </>
      ) : null}

      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  welcome: {
    marginTop: spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.xs,
  },
  inlineEmpty: {
    gap: spacing.xxs,
  },
  hint: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  hintRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hintText: {
    flex: 1,
    gap: 2,
  },
  hintActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  nextLine: {
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
});
