import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  Section,
  SegmentedControl,
  SkeletonList,
  Text,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { listPayments, type Payment } from '@/db/fees';
import { getSettings } from '@/db/settings';
import { loadAllFeeStatuses } from '@/domain/fees';
import { addDays, formatMonth, formatMonthYear, formatRelativeDay, formatShortDate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { METHOD_LABELS } from '@/lib/summaries';
import { spacing } from '@/theme';

async function loadFees(db: DB) {
  const settings = await getSettings(db);
  const t = today();
  const [statuses, payments, students] = await Promise.all([
    loadAllFeeStatuses(db, settings.currency),
    listPayments(db, undefined, 300),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM students'),
  ]);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const all = [...statuses.values()];
  const owing = all
    .filter((s) => s.balance > 0)
    .sort((a, b) => (a.unpaidSince ?? '').localeCompare(b.unpaidSince ?? ''));
  const upcoming = all
    .filter((s) => s.nextDue && s.nextDue.date <= addDays(t, 14))
    .sort((a, b) => a.nextDue!.date.localeCompare(b.nextDue!.date));
  const month = t.slice(0, 7);
  const collected = payments.filter((p) => p.paidOn.startsWith(month)).reduce((sum, p) => sum + p.amount, 0);
  const outstanding = owing.reduce((sum, s) => sum + s.balance, 0);
  return { currency: settings.currency, owing, upcoming, payments, names, collected, outstanding };
}

function groupByMonth(payments: Payment[]) {
  const groups: { month: string; total: number; items: Payment[] }[] = [];
  for (const p of payments) {
    const month = p.paidOn.slice(0, 7);
    let g = groups.at(-1);
    if (!g || g.month !== month) {
      g = { month, total: 0, items: [] };
      groups.push(g);
    }
    g.items.push(p);
    g.total += p.amount;
  }
  return groups;
}

export default function FeesScreen() {
  const [tab, setTab] = useState<'collect' | 'payments'>('collect');
  const { data, error, loading } = useQuery(loadFees, []);
  const t = today();

  return (
    <Screen inTabs largeTitle="Fees" hideAppBar contentStyle={styles.content}>
      {error ? (
        <ErrorState message={error.message} />
      ) : loading && !data ? (
        <SkeletonList rows={5} />
      ) : data ? (
        <>
          <Card style={styles.summary}>
            <Text variant="labelStrong" color="textSecondary">
              Outstanding
            </Text>
            <Text variant="amount" accessibilityLabel={`Outstanding ${formatMoney(data.outstanding, data.currency)}`}>
              {formatMoney(data.outstanding, data.currency)}
            </Text>
            <Divider />
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text variant="caption" color="textTertiary">
                  Collected in {formatMonth(t)}
                </Text>
                <Text variant="bodyStrong">{formatMoney(data.collected, data.currency)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text variant="caption" color="textTertiary">
                  Due in the next 2 weeks
                </Text>
                <Text variant="bodyStrong">
                  {formatMoney(
                    data.upcoming.reduce((sum, s) => sum + (s.nextDue?.amount ?? 0), 0),
                    data.currency,
                  )}
                </Text>
              </View>
            </View>
          </Card>

          <SegmentedControl
            options={[
              { value: 'collect', label: 'To collect' },
              { value: 'payments', label: 'Payments' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'collect' ? (
            <View style={styles.tabBody}>
              {data.owing.length === 0 && data.upcoming.length === 0 ? (
                <EmptyState
                  icon="check-circle-outline"
                  title="Nothing to collect"
                  message="Students with a fee plan show up here when a payment falls due."
                />
              ) : (
                <>
                  {data.owing.length > 0 && (
                    <Section title="Owed now">
                      <Card padded={false}>
                        {data.owing.map((s, i) => (
                          <View key={s.studentId}>
                            {i > 0 && <Divider inset={68} />}
                            <ListRow
                              title={data.names.get(s.studentId) ?? 'Student'}
                              subtitle={
                                s.unpaidSince === t
                                  ? 'Due today'
                                  : s.unpaidSince
                                    ? `Overdue since ${formatShortDate(s.unpaidSince)}`
                                    : 'Balance due'
                              }
                              leading={<Avatar name={data.names.get(s.studentId) ?? '?'} size={40} />}
                              trailing={
                                <Badge
                                  label={formatMoney(s.balance, s.currency)}
                                  tone={s.unpaidSince && s.unpaidSince < t ? 'danger' : 'warning'}
                                />
                              }
                              accessibilityHint="Record a payment"
                              onPress={() =>
                                router.push({ pathname: '/student/[id]/payment', params: { id: s.studentId } })
                              }
                            />
                          </View>
                        ))}
                      </Card>
                    </Section>
                  )}
                  {data.upcoming.length > 0 && (
                    <Section title="Coming up">
                      <Card padded={false}>
                        {data.upcoming.map((s, i) => (
                          <View key={s.studentId}>
                            {i > 0 && <Divider inset={68} />}
                            <ListRow
                              title={data.names.get(s.studentId) ?? 'Student'}
                              subtitle={`Due ${formatRelativeDay(s.nextDue!.date)}${
                                s.balance < 0 ? ' · paid in advance' : ''
                              }`}
                              leading={<Avatar name={data.names.get(s.studentId) ?? '?'} size={40} />}
                              trailing={
                                <Text variant="bodyStrong" color="textSecondary">
                                  {formatMoney(s.nextDue!.amount, s.currency)}
                                </Text>
                              }
                              onPress={() =>
                                router.push({ pathname: '/student/[id]', params: { id: s.studentId } })
                              }
                            />
                          </View>
                        ))}
                      </Card>
                    </Section>
                  )}
                </>
              )}
            </View>
          ) : (
            <View style={styles.tabBody}>
              {data.payments.length === 0 ? (
                <EmptyState
                  icon="cash-multiple"
                  title="No payments yet"
                  message="Payments you record from a student’s page are listed here."
                />
              ) : (
                groupByMonth(data.payments).map((g) => (
                  <Section
                    key={g.month}
                    title={`${formatMonthYear(`${g.month}-01`)} · ${formatMoney(g.total, data.currency)}`}
                  >
                    <Card padded={false}>
                      {g.items.map((p, i) => (
                        <View key={p.id}>
                          {i > 0 && <Divider inset={68} />}
                          <ListRow
                            title={data.names.get(p.studentId) ?? 'Former student'}
                            subtitle={[formatShortDate(p.paidOn), p.method ? METHOD_LABELS[p.method] : null]
                              .filter(Boolean)
                              .join(' · ')}
                            leading={<Avatar name={data.names.get(p.studentId) ?? '?'} size={40} />}
                            trailing={
                              <Text variant="bodyStrong" color="success">
                                +{formatMoney(p.amount, p.currency)}
                              </Text>
                            }
                            onPress={() => router.push({ pathname: '/student/[id]', params: { id: p.studentId } })}
                          />
                        </View>
                      ))}
                    </Card>
                  </Section>
                ))
              )}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCell: {
    flex: 1,
    gap: 2,
  },
  tabBody: {
    marginTop: spacing.xs,
  },
});
