import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { StudentForm } from '@/components/StudentForm';
import { Button, Screen, SkeletonList, useSnackbar } from '@/components/ui';
import { useQuery } from '@/db/core';
import { deleteStudent, getStudent, setStudentStatus, updateStudent } from '@/db/students';

export default function EditStudent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { data: student, loading } = useQuery((d) => getStudent(d, id), [id]);

  if (loading && !student) {
    return (
      <Screen title="Edit student" back backIcon="close">
        <SkeletonList rows={4} />
      </Screen>
    );
  }
  if (!student) return null;

  const archived = student.status === 'archived';

  const toggleArchive = async () => {
    await setStudentStatus(db, student.id, archived ? 'active' : 'archived');
    router.back();
    snackbar(
      archived ? `${student.name} is active again` : `${student.name} archived. Their lessons and reminders stop.`,
      {
        icon: 'archive-outline',
        action: archived
          ? undefined
          : { label: 'Undo', onPress: () => setStudentStatus(db, student.id, 'active') },
      },
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${student.name}?`,
      'This permanently removes their details, lessons, attendance and payment history. Archive instead to keep the history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteStudent(db, student.id);
            router.dismissTo('/students');
            snackbar(`${student.name} deleted`, { icon: 'delete-outline' });
          },
        },
      ],
    );
  };

  return (
    <StudentForm
      title="Edit student"
      submitLabel="Save changes"
      initial={student}
      onSubmit={async (input) => {
        await updateStudent(db, student.id, input);
        router.back();
        snackbar('Changes saved', { icon: 'check-circle-outline' });
      }}
    >
      <Button
        label={archived ? 'Restore student' : 'Archive student'}
        icon={archived ? 'restore' : 'archive-outline'}
        variant="secondary"
        onPress={toggleArchive}
        accessibilityHint={archived ? undefined : 'Hides them and stops their lessons, keeping history'}
      />
      <Button label="Delete student" icon="delete-outline" variant="danger" onPress={confirmDelete} />
    </StudentForm>
  );
}
