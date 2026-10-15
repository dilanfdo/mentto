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
  ListRow,
  Screen,
  SegmentedControl,
  SkeletonList,
  TextField,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
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

export default function StudentsScreen() {
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
  const subtitle =
    status === 'active'
      ? total
        ? `${total.active} active`
        : undefined
      : 'Students you’ve stopped teaching';

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
    <Screen inTabs scroll={false} largeTitle="Students" subtitle={subtitle} hideAppBar>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
