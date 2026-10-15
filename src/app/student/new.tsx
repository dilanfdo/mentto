import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { StudentForm } from '@/components/StudentForm';
import { useSnackbar } from '@/components/ui';
import { createStudent } from '@/db/students';

export default function NewStudent() {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();

  return (
    <StudentForm
      title="New student"
      submitLabel="Add student"
      onSubmit={async (input) => {
        const id = await createStudent(db, input);
        router.replace({ pathname: '/student/[id]', params: { id } });
        snackbar(`${input.name.trim()} added`, { icon: 'check-circle-outline' });
      }}
    />
  );
}
