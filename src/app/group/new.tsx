import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { usePro } from '@/billing/ProProvider';
import { countActive, overLimit } from '@/billing/limits';
import { GroupForm } from '@/components/GroupForm';
import { Screen, SkeletonList, useSnackbar } from '@/components/ui';
import { useQuery } from '@/db/core';
import { createGroup } from '@/db/groups';
import { listStudents } from '@/db/students';

export default function NewGroup() {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { isPro, ready } = usePro();
  const { data: students } = useQuery((d) => listStudents(d), []);
  const { data: counts } = useQuery(countActive, []);

  if (!students || !counts || !ready) {
    return (
      <Screen title="New group" back backIcon="close">
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (overLimit(counts.groups, 'groups', isPro)) {
    return <Redirect href={{ pathname: '/pro', params: { feature: 'groups' } }} />;
  }

  return (
    <GroupForm
      title="New group"
      submitLabel="Create group"
      students={students}
      onSubmit={async (input) => {
        const id = await createGroup(db, input);
        router.replace({ pathname: '/group/[id]', params: { id } });
        snackbar(`${input.name.trim()} created`, { icon: 'check-circle-outline' });
      }}
    />
  );
}
