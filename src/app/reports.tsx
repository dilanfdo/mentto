import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { usePro } from '@/billing/ProProvider';
import {
  Avatar,
  Card,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  Section,
  SkeletonList,
  Text,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { getSettings } from '@/db/settings';
import { loadAllFeeStatuses } from '@/domain/fees';
import { formatDuration, formatMonth, formatMonthYear, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { METHOD_LABELS } from '@/lib/summaries';
import { radii, spacing, useTheme } from '@/theme';

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function loadReport(db: DB, month: string) {
  const settings = await getSettings(db);
  const first = shiftMonth(month, -5);
  const [payments, sessions, statuses, names] = await Promise.all([
    db.getAllAsync<{ student_id: string; amount: number; paid_on: string; method: string | null }>(
      'SELECT student_id, amount, paid_on, method FROM payments WHERE paid_on >= ? ORDER BY paid_on',
      `${first}-01`,
    ),
    db.getAllAsync<{ schedule_id: string | null; starts_at: string; duration_min: number; status: string }>(
      `SELECT schedule_id, starts_at, duration_min, status FROM sessions WHERE substr(starts_at, 1, 7) = ?`,
      month,
    ),
    loadAllFeeStatuses(db, settings.currency),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM students'),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.name]));

  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(first, i);
    return { month: m, total: payments.filter((p) => p.paid_on.startsWith(m)).reduce((s, p) => s + p.amount, 0) };
  });
  const thisMonth = payments.filter((p) => p.paid_on.startsWith(month));
  const total = thisMonth.reduce((s, p) => s + p.amount, 0);
  const previous = trend[4].total;

  const sum = <K extends string>(rows: typeof thisMonth, key: (p: (typeof thisMonth)[number]) => K) => {
    const m = new Map<K, number>();
    for (const p of rows) m.set(key(p), (m.get(key(p)) ?? 0) + p.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // A lesson is one slot at one time, however many students were in it.
  const lessons = new Map<string, { minutes: number; attended: number; marked: number }>();
  for (const s of sessions) {
    const key = `${s.schedule_id ?? 'x'}:${s.starts_at}`;
    const l = lessons.get(key) ?? { minutes: s.duration_min, attended: 0, marked: 0 };
    l.marked += 1;
    if (s.status === 'attended') l.attended += 1;
    lessons.set(key, l);
  }
  const held = [...lessons.values()].filter((l) => l.attended > 0);
  const seats = [...lessons.values()].reduce((s, l) => s + l.marked, 0);
  const came = [...lessons.values()].reduce((s, l) => s + l.attended, 0);
  const owing = [...statuses.values()].filter((s) => s.balance > 0);

  return {
    currency: settings.currency,
    total,
    change: previous > 0 ? Math.round(((total - previous) / previous) * 100) : null,
    trend,
    byMethod: sum(thisMonth, (p) => p.method ?? 'other'),
    byStudent: sum(thisMonth, (p) => p.student_id).map(([id, amount]) => ({ id, name: nameOf.get(id) ?? 'Former student', amount })),
    lessonsHeld: held.length,
    minutes: held.reduce((s, l) => s + l.minutes, 0),
    attendanceRate: seats > 0 ? Math.round((came / seats) * 100) : null,
    outstanding: owing.reduce((s, o) => s + o.balance, 0),
    owingCount: owing.length,
  };
}

function Bars({ data, currency, month }: { data: { month: string; total: number }[]; currency: string; month: string }) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <View style={styles.bars} accessibilityLabel={data.map((d) => `${formatMonth(`${d.month}-01`)} ${formatMoney(d.total, currency)}`).join(', ')}>
      {data.map((d) => {
        const current = d.month === month;
        return (
          <View key={d.month} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 0)}%`, backgroundColor: current ? colors.primary : colors.primarySoft },
                ]}
              />
            </View>
            <Text variant="caption" color={current ? 'text' : 'textTertiary'}>
              {formatMonth(`${d.month}-01`).slice(0, 3)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ReportsScreen() {
  const { isPro, ready } = usePro();
  const { colors } = useTheme();
  const current = today().slice(0, 7);
  const [month, setMonth] = useState(current);
  const { data, loading } = useQuery((db) => loadReport(db, month), [month]);

  if (ready && !isPro) return <Redirect href={{ pathname: '/pro', params: { feature: 'reports' } }} />;

  return (
    <Screen title="Reports" back contentStyle={styles.content}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text variant="title" accessibilityRole="header" style={styles.monthTitle}>
          {formatMonthYear(`${month}-01`)}
        </Text>
        <IconButton
          icon="chevron-right"
          label="Next month"
          disabled={month >= current}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </View>

      {loading && !data ? (
        <SkeletonList rows={5} />
      ) : data ? (
        <Animated.View key={month} entering={FadeIn.duration(180)} style={styles.content}>
          <Card style={styles.stack}>
            <Text variant="labelStrong" color="textSecondary">
              Collected
            </Text>
            <Text variant="amount">{formatMoney(data.total, data.currency)}</Text>
            {data.change !== null && (
              <Text variant="label" color={data.change >= 0 ? 'success' : 'danger'}>
                {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.change)}% on {formatMonth(`${shiftMonth(month, -1)}-01`)}
              </Text>
            )}
            <Bars data={data.trend} currency={data.currency} month={month} />
          </Card>

          <View style={styles.tiles}>
            <Card style={styles.tile}>
              <Text variant="caption" color="textTertiary">
                Lessons taught
              </Text>
              <Text variant="title">{data.lessonsHeld}</Text>
              <Text variant="caption" color="textTertiary">
                {formatDuration(data.minutes)}
              </Text>
            </Card>
            <Card style={styles.tile}>
              <Text variant="caption" color="textTertiary">
                Attendance
              </Text>
              <Text variant="title">{data.attendanceRate === null ? '–' : `${data.attendanceRate}%`}</Text>
              <Text variant="caption" color="textTertiary">
                of booked places
              </Text>
            </Card>
            <Card style={styles.tile}>
              <Text variant="caption" color="textTertiary">
                Owed now
              </Text>
              <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(data.outstanding, data.currency)}
              </Text>
              <Text variant="caption" color="textTertiary">
                {data.owingCount} {data.owingCount === 1 ? 'student' : 'students'}
              </Text>
            </Card>
          </View>

          {data.total === 0 ? (
            <EmptyState compact icon="cash-multiple" title="No payments this month" />
          ) : (
            <>
              <Section title="By payment method">
                <Card style={styles.stack}>
                  {data.byMethod.map(([method, amount]) => (
                    <View key={method} style={styles.methodRow}>
                      <Text variant="body" style={styles.methodName}>
                        {METHOD_LABELS[method] ?? method}
                      </Text>
                      <View style={[styles.methodTrack, { backgroundColor: colors.surfaceMuted }]}>
                        <View style={[styles.methodBar, { width: `${(amount / data.total) * 100}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text variant="bodyStrong" style={styles.methodAmount}>
                        {formatMoney(amount, data.currency)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </Section>

              <Section title="By student">
                <Card padded={false}>
                  {data.byStudent.map((s, i) => (
                    <View key={s.id}>
                      {i > 0 && <Divider inset={68} />}
                      <ListRow
                        title={s.name}
                        leading={<Avatar name={s.name} size={40} />}
                        trailing={<Text variant="bodyStrong">{formatMoney(s.amount, data.currency)}</Text>}
                      />
                    </View>
                  ))}
                </Card>
              </Section>
            </>
          )}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
  },
  stack: {
    gap: spacing.xs,
  },
  bars: {
    flexDirection: 'row',
    gap: spacing.xs,
    height: 120,
    marginTop: spacing.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: radii.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tile: {
    flex: 1,
    gap: 2,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
  },
  methodName: {
    width: 108,
  },
  methodTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  methodBar: {
    height: 8,
    borderRadius: 4,
  },
  methodAmount: {
    minWidth: 84,
    textAlign: 'right',
  },
});
