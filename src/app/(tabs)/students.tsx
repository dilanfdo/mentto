import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Fab,
  Icon,
  ListRow,
  Screen,
  SegmentedControl,
  SkeletonList,
  TextField,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { listGroups } from '@/db/groups';
import { listActiveSchedules } from '@/db/schedules';
import { getSettings } from '@/db/settings';
import { countStudents, listStudents, type StudentStatus } from '@/db/students';
import { loadAllFeeStatuses } from '@/domain/fees';
import { formatMoney } from '@/lib/money';
import { summarizeSlots } from '@/lib/summaries';
import { radii, spacing, useTheme } from '@/theme';

async function loadStudents(db: DB, status: StudentStatus) {
  const settings = await getSettings(db);
  const [students, schedules, statuses, counts] = await Promise.all([
    listStudents(db, status),
    listActiveSchedules(db),
    loadAllFeeStatuses(db, settings.currency),
    countStudents(db),
  ]);
  return students.map((s) => ({
    student: s,
    slots: summarizeSlots(schedules.filter((x) => x.studentId === s.id)),
    fee: statuses.get(s.id) ?? null,
    counts,
  }));
}

function StudentsList() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<StudentStatus>('active');
  const [search, setSearch] = useState('');
  const { data, error, loading } = useQuery((db) => loadStudents(db, status), [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      ({ student }) =>
        student.name.toLowerCase().includes(q) ||
        student.phone?.includes(q) ||
        student.guardianName?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const total = data?.[0]?.counts;

  const header = (
    <View style={styles.header}>
      {(data?.length ?? 0) > 6 || search ? (
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name, phone or parent"
          leadingIcon="magnify"
          returnKeyType="search"
          autoCorrect={false}
        />
      ) : null}
      {(total?.archived ?? 0) > 0 || status === 'archived' ? (
        <SegmentedControl
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
          value={status}
          onChange={setStatus}
        />
      ) : null}
    </View>
  );

  return (
    <>
      {error ? (
        <ErrorState message={error.message} />
      ) : loading && !data ? (
        <View style={styles.pad}>
          <SkeletonList rows={6} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.student.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <Divider inset={72} />}
          renderItem={({ item, index }) => {
            const owed = item.fee && item.fee.balance > 0 ? item.fee.balance : 0;
            const first = index === 0;
            const last = index === filtered.length - 1;
            return (
              <View
                // Remount when a row's rounded corners change (list grew or shrank); Android otherwise
                // keeps the old clip and can leave the row blank.
                key={`${first}-${last}`}
                style={[
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  styles.item,
                  first && styles.first,
                  last && styles.last,
                ]}
              >
                <ListRow
                  title={item.student.name}
                  subtitle={item.slots ?? (status === 'archived' ? 'Archived' : 'No weekly slot yet')}
                  leading={<Avatar name={item.student.name} dimmed={status === 'archived'} />}
                  trailing={
                    owed > 0 ? (
                      <Badge label={formatMoney(owed, item.fee!.currency)} tone="warning" icon="alert-circle-outline" />
                    ) : undefined
                  }
                  accessibilityLabel={[
                    item.student.name,
                    item.slots,
                    owed > 0 ? `owes ${formatMoney(owed, item.fee!.currency)}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  onPress={() => router.push({ pathname: '/student/[id]', params: { id: item.student.id } })}
                />
              </View>
            );
          }}
          ListEmptyComponent={
            search ? (
              <EmptyState compact icon="magnify" title="No matches" message={`Nobody matches “${search.trim()}”.`} />
            ) : status === 'archived' ? (
              <EmptyState compact icon="archive-outline" title="No archived students" />
            ) : (
              <EmptyState
                icon="account-group-outline"
                title="Your students live here"
                message="Add a student to keep their details, lesson times and fees together."
                action={<Button label="Add student" icon="plus" onPress={() => router.push('/student/new')} />}
              />
            )
          }
        />
      )}
      {status === 'active' && (data?.length ?? 0) > 0 && (
        <Fab icon="account-plus-outline" label="Add student" onPress={() => router.push('/student/new')} />
      )}
    </>
  );
}

async function loadGroups(db: DB) {
  const [groups, schedules] = await Promise.all([listGroups(db), listActiveSchedules(db)]);
  return groups.map((g) => ({ group: g, slots: summarizeSlots(schedules.filter((s) => s.groupId === g.id)) }));
}

function GroupsList() {
  const { colors } = useTheme();
  const { data, error, loading } = useQuery(loadGroups, []);

  if (error) return <ErrorState message={error.message} />;
  if (loading && !data) {
    return (
      <View style={styles.pad}>
        <SkeletonList rows={4} />
      </View>
    );
  }
  const groups = data ?? [];
  return (
    <>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.group.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <Divider inset={72} />}
        renderItem={({ item, index }) => (
          <View
            key={`${index === 0}-${index === groups.length - 1}`}
            style={[
              { backgroundColor: colors.surface, borderColor: colors.border },
              styles.item,
              index === 0 && styles.first,
              index === groups.length - 1 && styles.last,
            ]}
          >
            <ListRow
              title={item.group.name}
              subtitle={[
                `${item.group.members.length} ${item.group.members.length === 1 ? 'student' : 'students'}`,
                item.slots ?? 'No weekly slot yet',
              ].join(' · ')}
              leading={
                <View style={[styles.groupIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="account-group" size={22} color="onPrimarySoft" />
                </View>
              }
              chevron
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: item.group.id } })}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="account-group-outline"
            title="Teach classes?"
            message="Put students in a group to schedule one class for all of them and take attendance together."
            action={<Button label="New group" icon="plus" onPress={() => router.push('/group/new')} />}
          />
        }
      />
      {groups.length > 0 && <Fab icon="account-multiple-plus-outline" label="New group" onPress={() => router.push('/group/new')} />}
    </>
  );
}

export default function StudentsScreen() {
  const [view, setView] = useState<'students' | 'groups'>('students');
  return (
    <Screen inTabs scroll={false} largeTitle="Students" hideAppBar>
      <View style={styles.switcher}>
        <SegmentedControl
          options={[
            { value: 'students', label: 'Students' },
            { value: 'groups', label: 'Groups' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'students' ? <StudentsList /> : <GroupsList />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pad: {
    paddingHorizontal: spacing.md,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 112,
  },
  item: {
    borderLeftWidth: StyleSheet.hairlineWidth * 2,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
});
