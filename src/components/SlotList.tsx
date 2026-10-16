import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Schedule, SlotOwner } from '@/db/schedules';
import { formatDuration, formatShortDate, today } from '@/lib/dates';
import { describeSlot } from '@/lib/summaries';
import { spacing } from '@/theme';

import { Button, Card, Divider, ListRow, Section, Text } from './ui';

type Props = {
  owner: SlotOwner;
  /** First name or group name, for the empty-state hint. */
  name: string;
  slots: Schedule[];
};

const slotParams = (owner: SlotOwner) => (owner.studentId ? { studentId: owner.studentId } : { groupId: owner.groupId! });

/** "Lessons" on a student or group page: weekly slots, then upcoming one-off lessons. */
export function SlotList({ owner, name, slots }: Props) {
  const weekly = slots.filter((s) => !s.rule.once);
  const extra = slots.filter((s) => s.rule.once);
  const add = (mode: 'weekly' | 'once') => router.push({ pathname: '/slot', params: { ...slotParams(owner), mode } });
  const open = (slot: Schedule) => router.push({ pathname: '/slot', params: { ...slotParams(owner), slotId: slot.id } });

  const row = (slot: Schedule) => (
    <ListRow
      leadingIcon={slot.rule.once ? 'calendar-star' : 'calendar-clock'}
      title={describeSlot(slot)}
      subtitle={[
        slot.rule.once ? 'One-off' : null,
        formatDuration(slot.durationMin),
        slot.location,
        !slot.rule.once && slot.startsOn > today() ? `Starts ${formatShortDate(slot.startsOn)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      chevron
      onPress={() => open(slot)}
    />
  );

  return (
    <Section
      title="Lessons"
      action={slots.length > 0 ? { label: 'Add', onPress: () => add('weekly') } : undefined}
    >
      {slots.length === 0 ? (
        <Card>
          <View style={styles.stack}>
            <Text variant="bodyStrong">No lessons scheduled</Text>
            <Text variant="label" color="textSecondary">
              Pick the days and time {name} {owner.groupId ? 'meets' : 'comes'} each week, or book a single lesson.
            </Text>
            <View style={styles.buttons}>
              <Button label="Weekly slot" icon="calendar-plus" variant="secondary" size="small" onPress={() => add('weekly')} />
              <Button label="One-off" icon="calendar-star" variant="ghost" size="small" onPress={() => add('once')} />
            </View>
          </View>
        </Card>
      ) : (
        <Card padded={false}>
          {[...weekly, ...extra].map((slot, i) => (
            <View key={slot.id}>
              {i > 0 && <Divider inset={68} />}
              {row(slot)}
            </View>
          ))}
          {extra.length === 0 && (
            <>
              <Divider inset={68} />
              <ListRow leadingIcon="calendar-star" title="Book an extra lesson" onPress={() => add('once')} />
            </>
          )}
        </Card>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
