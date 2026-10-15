import { FlatList, StyleSheet, View } from 'react-native';

import { useQuery } from '@/db/core';
import { listStudents } from '@/db/students';
import { spacing } from '@/theme';

import { Avatar, Button, EmptyState, ListRow, Sheet } from './ui';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (studentId: string) => void;
  onAddStudent: () => void;
};

export function StudentPickerSheet({ visible, title, onClose, onPick, onAddStudent }: Props) {
  const { data: students } = useQuery((db) => listStudents(db), []);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {students && students.length === 0 ? (
        <EmptyState
          compact
          icon="account-plus-outline"
          title="No students yet"
          message="Add a student first, then give them a time slot."
          action={<Button label="Add student" icon="plus" onPress={onAddStudent} />}
        />
      ) : (
        <FlatList
          data={students ?? []}
          keyExtractor={(s) => s.id}
          style={styles.list}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              leading={<Avatar name={item.name} size={40} />}
              onPress={() => onPick(item.id)}
            />
          )}
          ListFooterComponent={<View style={styles.footer} />}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  footer: {
    height: spacing.xs,
  },
});
