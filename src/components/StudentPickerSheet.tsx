import { ScrollView, StyleSheet, View } from 'react-native';

import { useQuery } from '@/db/core';
import { listGroups } from '@/db/groups';
import type { SlotOwner } from '@/db/schedules';
import { listStudents } from '@/db/students';
import { radii, spacing, useTheme } from '@/theme';

import { Avatar, Button, EmptyState, Icon, ListRow, Sheet, Text } from './ui';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (owner: SlotOwner) => void;
  onAddStudent: () => void;
};

/** Pick who a new lesson is for: a group (listed first) or a single student. */
export function StudentPickerSheet({ visible, title, onClose, onPick, onAddStudent }: Props) {
  const { colors } = useTheme();
  const { data } = useQuery(async (db) => ({ students: await listStudents(db), groups: await listGroups(db) }), []);
  const students = data?.students ?? [];
  const groups = data?.groups ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {data && students.length === 0 && groups.length === 0 ? (
        <EmptyState
          compact
          icon="account-plus-outline"
          title="No students yet"
          message="Add a student first, then give them a lesson time."
          action={<Button label="Add student" icon="plus" onPress={onAddStudent} />}
        />
      ) : (
        <ScrollView style={styles.list}>
          {groups.length > 0 && (
            <>
              <Text variant="labelStrong" color="textSecondary" style={styles.heading}>
                Groups
              </Text>
              {groups.map((g) => (
                <ListRow
                  key={g.id}
                  title={g.name}
                  subtitle={`${g.members.length} ${g.members.length === 1 ? 'student' : 'students'}`}
                  leading={
                    <View style={[styles.groupIcon, { backgroundColor: colors.primarySoft }]}>
                      <Icon name="account-group" size={20} color="onPrimarySoft" />
                    </View>
                  }
                  onPress={() => onPick({ groupId: g.id })}
                />
              ))}
              <Text variant="labelStrong" color="textSecondary" style={styles.heading}>
                Students
              </Text>
            </>
          )}
          {students.map((s) => (
            <ListRow
              key={s.id}
              title={s.name}
              leading={<Avatar name={s.name} size={40} />}
              onPress={() => onPick({ studentId: s.id })}
            />
          ))}
          <View style={styles.footer} />
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  heading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    height: spacing.xs,
  },
});
