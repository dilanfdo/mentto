import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LessonRow } from '@/components/LessonRow';
import { LessonSheet } from '@/components/LessonSheet';
import { SlotList } from '@/components/SlotList';
import {
  Avatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Section,
  SkeletonList,
  Text,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { getGroup } from '@/db/groups';
import { listOwnerSchedules } from '@/db/schedules';
import { attendedCount, loadLessons, loadNextLesson, type Lesson } from '@/domain/lessons';
import { addDays, formatRelativeDayInline, formatTime, today } from '@/lib/dates';
import { radii, spacing, useTheme } from '@/theme';

async function loadGroupPage(db: DB, id: string) {
  const group = await getGroup(db, id);
  if (!group) return null;
  const t = today();
  const [slots, recent, next] = await Promise.all([
    listOwnerSchedules(db, { groupId: id }),
    loadLessons(db, addDays(t, -60), t, { groupId: id }),
    group.status === 'active' ? loadNextLesson(db, { groupId: id }) : Promise.resolve(null),
  ]);
  const held = recent.filter((l) => l.status === 'attended' || l.status === 'missed');
  const seats = held.reduce((sum, l) => sum + l.members.length, 0);
  const came = held.reduce((sum, l) => sum + attendedCount(l), 0);
  return {
    group,
    slots,
    next,
    recent: recent.filter((l) => l.status !== 'upcoming' || l.date === t).reverse().slice(0, 5),
    attendanceRate: seats > 0 ? Math.round((came / seats) * 100) : null,
  };
}

export default function GroupPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Lesson | null>(null);
  const { data, loading } = useQuery((d) => loadGroupPage(d, id), [id]);

  if (loading && !data) {
    return (
      <Screen back>
        <SkeletonList rows={5} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen back>
        <EmptyState icon="account-group-outline" title="Group not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const { group } = data;
  const archived = group.status === 'archived';

  return (
    <Screen
      back
      actions={
        <IconButton
          icon="pencil-outline"
          label="Edit group"
          onPress={() => router.push({ pathname: '/group/[id]/edit', params: { id } })}
        />
      }
    >
      <Animated.View entering={FadeIn.duration(220)}>
        <View style={styles.hero}>
          <View style={[styles.mark, { backgroundColor: colors.primarySoft }]}>
            <Icon name="account-group" size={34} color="onPrimarySoft" />
          </View>
          <Text variant="title" align="center" accessibilityRole="header">
            {group.name}
          </Text>
          {archived ? (
            <Badge label="Archived" icon="archive-outline" />
          ) : (
            <Text variant="label" color="textSecondary" align="center">
              {group.members.length} {group.members.length === 1 ? 'student' : 'students'}
              {data.next ? ` · Next ${formatRelativeDayInline(data.next.date)} at ${formatTime(data.next.startTime)}` : ''}
            </Text>
          )}
        </View>

        <Section
          title="Students"
          action={{ label: 'Edit', onPress: () => router.push({ pathname: '/group/[id]/edit', params: { id } }) }}
        >
          {group.members.length === 0 ? (
            <Card>
              <Text variant="label" color="textSecondary">
                No students in this group yet. Tap Edit to add some.
              </Text>
            </Card>
          ) : (
            <Card padded={false}>
              {group.members.map((m, i) => (
                <View key={m.id}>
                  {i > 0 && <Divider inset={68} />}
                  <ListRow
                    title={m.name}
                    leading={<Avatar name={m.name} size={40} />}
                    chevron
                    onPress={() => router.push({ pathname: '/student/[id]', params: { id: m.id } })}
                  />
                </View>
              ))}
            </Card>
          )}
          <Text variant="caption" color="textTertiary">
            Fees are set per student on each student’s page.
          </Text>
        </Section>

        {!archived && <SlotList owner={{ groupId: id }} name={group.name} slots={data.slots} />}

        {data.recent.length > 0 && (
          <Section title="Recent lessons">
            {data.attendanceRate !== null && (
              <Text variant="label" color="textSecondary">
                Attendance over the last two months: {data.attendanceRate}%
              </Text>
            )}
            <View style={styles.list}>
              {data.recent.map((lesson) => (
                <LessonRow key={lesson.key} lesson={lesson} showDate onPress={() => setSelected(lesson)} />
              ))}
            </View>
          </Section>
        )}

        {group.notes && (
          <Section title="Notes">
            <Card>
              <Text variant="body">{group.notes}</Text>
            </Card>
          </Section>
        )}
      </Animated.View>

      <LessonSheet lesson={selected} onClose={() => setSelected(null)} ownerId={id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  list: {
    gap: spacing.xs,
  },
});
