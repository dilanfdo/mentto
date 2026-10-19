import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { openPaywall, usePro } from '@/billing/ProProvider';
import { countActive, overLimit } from '@/billing/limits';
import { GroupForm } from '@/components/GroupForm';
import { Button, Screen, SkeletonList, useSnackbar } from '@/components/ui';
import { useQuery } from '@/db/core';
import { deleteGroup, getGroup, setGroupStatus, updateGroup } from '@/db/groups';
import { listStudents } from '@/db/students';

export default function EditGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { isPro } = usePro();
  const { data, loading } = useQuery(
    async (d) => ({ group: await getGroup(d, id), students: await listStudents(d) }),
    [id],
  );

  if (loading && !data) {
    return (
      <Screen title="Edit group" back backIcon="close">
        <SkeletonList rows={4} />
      </Screen>
    );
  }
  const group = data?.group;
  if (!group || !data) return null;
  const archived = group.status === 'archived';

  const toggleArchive = async () => {
    if (archived && overLimit((await countActive(db)).groups, 'groups', isPro)) {
      openPaywall('groups');
      return;
    }
    await setGroupStatus(db, group.id, archived ? 'active' : 'archived');
    router.back();
    snackbar(archived ? `${group.name} is active again` : `${group.name} archived. Its lessons stop.`, {
      icon: 'archive-outline',
      action: archived ? undefined : { label: 'Undo', onPress: () => setGroupStatus(db, group.id, 'active') },
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${group.name}?`,
      'The group and its lesson times are removed. Each student keeps their own attendance and fee history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup(db, group.id);
            router.dismissTo('/students');
            snackbar(`${group.name} deleted`, { icon: 'delete-outline' });
          },
        },
      ],
    );
  };

  return (
    <GroupForm
      title="Edit group"
      submitLabel="Save changes"
      students={data.students}
      initial={{ name: group.name, notes: group.notes, memberIds: group.members.map((m) => m.id) }}
      onSubmit={async (input) => {
        await updateGroup(db, group.id, input);
        router.back();
        snackbar('Changes saved', { icon: 'check-circle-outline' });
      }}
    >
      <Button
        label={archived ? 'Restore group' : 'Archive group'}
        icon={archived ? 'restore' : 'archive-outline'}
        variant="secondary"
        onPress={toggleArchive}
      />
      <Button label="Delete group" icon="delete-outline" variant="danger" onPress={confirmDelete} />
    </GroupForm>
  );
}
