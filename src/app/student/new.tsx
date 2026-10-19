import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { usePro } from '@/billing/ProProvider';
import { countActive, overLimit } from '@/billing/limits';
import { StudentForm } from '@/components/StudentForm';
import { Screen, SkeletonList, useSnackbar } from '@/components/ui';
import { useQuery } from '@/db/core';
import { createStudent } from '@/db/students';

export default function NewStudent() {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { isPro, ready } = usePro();
  const { data: counts } = useQuery(countActive, []);

  if (!ready || !counts) {
    return (
      <Screen title="New student" back backIcon="close">
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  // Every route to this screen passes through here, so the free limit is enforced in one place.
  if (overLimit(counts.students, 'students', isPro)) {
    return <Redirect href={{ pathname: '/pro', params: { feature: 'students' } }} />;
  }

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
