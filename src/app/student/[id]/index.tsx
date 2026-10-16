import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LessonRow } from '@/components/LessonRow';
import { LessonSheet } from '@/components/LessonSheet';
import { SlotList } from '@/components/SlotList';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  Screen,
  Section,
  SkeletonList,
  Text,
  useSnackbar,
  type IconName,
} from '@/components/ui';
import { useQuery, type DB } from '@/db/core';
import { deletePayment, listPayments } from '@/db/fees';
import { listStudentGroups } from '@/db/groups';
import { listOwnerSchedules } from '@/db/schedules';
import { getSettings } from '@/db/settings';
import { getStudent } from '@/db/students';
import { loadFeeStatus } from '@/domain/fees';
import { loadLessons, loadNextLesson, type Lesson } from '@/domain/lessons';
import { callPhone, sendEmail, sendSms, shareText } from '@/lib/contact';
import {
  addDays,
  formatRelativeDay,
  formatRelativeDayInline,
  formatShortDate,
  formatTime,
  today,
} from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { describePlan, METHOD_LABELS, summarizeSlots } from '@/lib/summaries';
import { radii, spacing, useTheme } from '@/theme';

async function loadStudentPage(db: DB, id: string) {
  const student = await getStudent(db, id);
  if (!student) return null;
  const settings = await getSettings(db);
  const t = today();
  const [slots, fee, payments, recent, next, groups] = await Promise.all([
    listOwnerSchedules(db, { studentId: id }),
    loadFeeStatus(db, id, settings.currency),
    listPayments(db, id, 10),
    loadLessons(db, addDays(t, -60), t, { studentId: id }),
    student.status === 'active' ? loadNextLesson(db, { studentId: id }) : Promise.resolve(null),
    listStudentGroups(db, id),
  ]);
  const groupSlots = await Promise.all(groups.map((g) => listOwnerSchedules(db, { groupId: g.id })));
  const month = t.slice(0, 7);
  const thisMonth = recent.filter((l) => l.date.startsWith(month));
  return {
    student,
    settings,
    slots,
    groups: groups.map((g, i) => ({ ...g, slots: summarizeSlots(groupSlots[i]) })),
    fee,
    payments,
    next,
    recent: recent.filter((l) => l.status !== 'upcoming' || l.date === t).reverse().slice(0, 5),
    attended: thisMonth.filter((l) => l.status === 'attended').length,
    missed: thisMonth.filter((l) => l.status === 'missed').length,
  };
}

function QuickAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.quick, disabled && { opacity: 0.4 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={22} color="onPrimarySoft" />
      </View>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}

export default function StudentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Lesson | null>(null);
  const { data, loading } = useQuery((d) => loadStudentPage(d, id), [id]);

  if (loading && !data) {
    return (
      <Screen back>
        <SkeletonList rows={5} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen back>
        <EmptyState icon="account-outline" title="Student not found" message="They may have been deleted." />
      </Screen>
    );
  }

  const { student, fee, settings } = data;
  const firstName = student.name.split(' ')[0];
  const contactPhone = student.phone ?? student.guardianPhone;
  const owed = fee.balance > 0 ? fee.balance : 0;
  const archived = student.status === 'archived';
  const hasFees = fee.plan !== null || fee.totalPaid > 0 || fee.balance !== 0;

  const reminderText = () => {
    const amount = formatMoney(owed || fee.nextDue?.amount || 0, fee.currency);
    const when =
      owed > 0
        ? fee.unpaidSince && fee.unpaidSince < today()
          ? `was due on ${formatShortDate(fee.unpaidSince)}`
          : 'is due today'
        : fee.nextDue
          ? `will be due on ${formatShortDate(fee.nextDue.date)}`
          : 'is due';
    const sign = settings.tutorName ? `\n– ${settings.tutorName}` : '';
    return `Hi ${firstName}, a friendly reminder that the lesson fee of ${amount} ${when}. Thank you!${sign}`;
  };

  const confirmDeletePayment = (paymentId: string, amount: number) => {
    Alert.alert('Delete this payment?', `${formatMoney(amount, fee.currency)} will be added back to the balance.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePayment(db, paymentId);
          snackbar('Payment deleted', { icon: 'delete-outline' });
        },
      },
    ]);
  };

  const feeHeadline =
    owed > 0
      ? { text: `Owes ${formatMoney(owed, fee.currency)}`, color: 'warning' as const }
      : fee.balance < 0
        ? { text: `${formatMoney(-fee.balance, fee.currency)} in credit`, color: 'success' as const }
        : { text: 'All paid up', color: 'success' as const };

  const feeDetail =
    owed > 0
      ? fee.unpaidSince === today()
        ? 'Due today'
        : fee.unpaidSince
          ? `Overdue since ${formatShortDate(fee.unpaidSince)}`
          : null
      : fee.nextDue
        ? `Next ${formatMoney(fee.nextDue.amount, fee.currency)} due ${formatRelativeDay(fee.nextDue.date)}`
        : null;

  return (
    <Screen
      back
      actions={
        <IconButton
          icon="pencil-outline"
          label="Edit student"
          onPress={() => router.push({ pathname: '/student/[id]/edit', params: { id } })}
        />
      }
    >
      <Animated.View entering={FadeIn.duration(220)}>
        <View style={styles.hero}>
          <Avatar name={student.name} size={72} dimmed={archived} />
          <View style={styles.heroText}>
            <Text variant="title" align="center" accessibilityRole="header">
              {student.name}
            </Text>
            {archived ? (
              <Badge label="Archived" icon="archive-outline" />
            ) : data.next ? (
              <Text variant="label" color="textSecondary" align="center">
                Next lesson {formatRelativeDayInline(data.next.date)} at {formatTime(data.next.startTime)}
                {data.next.groupId ? ` · ${data.next.title}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.quickRow}>
            <QuickAction
              icon="phone-outline"
              label="Call"
              disabled={!contactPhone}
              onPress={() => contactPhone && callPhone(contactPhone)}
            />
            <QuickAction
              icon="message-text-outline"
              label="Message"
              disabled={!contactPhone}
              onPress={() => contactPhone && sendSms(contactPhone)}
            />
            <QuickAction
              icon="bell-ring-outline"
              label="Remind"
              disabled={!hasFees}
              onPress={() => shareText(reminderText())}
            />
          </View>
        </View>

        <Section title="Fees">
          {!hasFees ? (
            <Card>
              <View style={styles.cardStack}>
                <Text variant="bodyStrong">No fee plan yet</Text>
                <Text variant="label" color="textSecondary">
                  Charge monthly, per term or per lesson attended. Mentto works out what’s owed.
                </Text>
                <Button
                  label="Set up fees"
                  icon="cash-plus"
                  variant="secondary"
                  size="small"
                  style={styles.alignStart}
                  onPress={() => router.push({ pathname: '/student/[id]/plan', params: { id } })}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <View style={styles.cardStack}>
                <Text variant="title" color={feeHeadline.color}>
                  {feeHeadline.text}
                </Text>
                {feeDetail && (
                  <Text variant="label" color="textSecondary">
                    {feeDetail}
                  </Text>
                )}
                <Divider />
                <Pressable
                  onPress={() => router.push({ pathname: '/student/[id]/plan', params: { id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Fee plan: ${fee.plan ? describePlan(fee.plan) : 'none'}. Change`}
                  style={styles.planRow}
                >
                  <Icon name="cash" size={20} color="textTertiary" />
                  <Text variant="label" color="textSecondary" style={styles.flex}>
                    {fee.plan ? describePlan(fee.plan) : 'No current plan'}
                  </Text>
                  <Text variant="labelStrong" color="primary">
                    {fee.plan ? 'Change' : 'Set up'}
                  </Text>
                </Pressable>
                <View style={styles.buttonRow}>
                  <Button
                    label="Record payment"
                    icon="cash-plus"
                    size="small"
                    onPress={() => router.push({ pathname: '/student/[id]/payment', params: { id } })}
                    style={styles.flex}
                  />
                  {owed > 0 && (
                    <Button
                      label="Send reminder"
                      icon="share-variant-outline"
                      size="small"
                      variant="secondary"
                      onPress={() => shareText(reminderText())}
                      style={styles.flex}
                    />
                  )}
                </View>
              </View>
            </Card>
          )}
        </Section>

        {!archived && <SlotList owner={{ studentId: id }} name={firstName} slots={data.slots} />}

        {data.groups.length > 0 && (
          <Section title="Groups">
            <Card padded={false}>
              {data.groups.map((g, i) => (
                <View key={g.id}>
                  {i > 0 && <Divider inset={68} />}
                  <ListRow
                    leadingIcon="account-group-outline"
                    title={g.name}
                    subtitle={g.slots ?? 'No weekly slot yet'}
                    chevron
                    onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
                  />
                </View>
              ))}
            </Card>
          </Section>
        )}

        {data.recent.length > 0 && (
          <Section title="Recent lessons">
            <Text variant="label" color="textSecondary">
              This month: {data.attended} attended{data.missed > 0 ? ` · ${data.missed} missed` : ''}
            </Text>
            <View style={styles.list}>
              {data.recent.map((lesson) => (
                <LessonRow key={lesson.key} lesson={lesson} showDate hideName onPress={() => setSelected(lesson)} />
              ))}
            </View>
          </Section>
        )}

        {data.payments.length > 0 && (
          <Section title="Payments">
            <Card padded={false}>
              {data.payments.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <Divider inset={68} />}
                  <ListRow
                    leadingIcon="cash-check"
                    title={formatMoney(p.amount, p.currency)}
                    subtitle={[formatShortDate(p.paidOn), p.method ? METHOD_LABELS[p.method] : null, p.note]
                      .filter(Boolean)
                      .join(' · ')}
                    onLongPress={() => confirmDeletePayment(p.id, p.amount)}
                    onPress={() => confirmDeletePayment(p.id, p.amount)}
                    accessibilityHint="Opens an option to delete this payment"
                  />
                </View>
              ))}
            </Card>
          </Section>
        )}

        <Section title="Details">
          <Card padded={false}>
            {[
              student.phone && { icon: 'phone-outline' as const, title: student.phone, sub: 'Phone', onPress: () => callPhone(student.phone!) },
              student.email && { icon: 'email-outline' as const, title: student.email, sub: 'Email', onPress: () => sendEmail(student.email!) },
              (student.guardianName || student.guardianPhone) && {
                icon: 'account-heart-outline' as const,
                title: student.guardianName ?? 'Parent or guardian',
                sub: ['Parent or guardian', student.guardianPhone].filter(Boolean).join(' · '),
                onPress: student.guardianPhone ? () => callPhone(student.guardianPhone!) : undefined,
              },
              student.notes && { icon: 'note-text-outline' as const, title: student.notes, sub: 'Notes' },
            ]
              .filter((x): x is Exclude<typeof x, null | undefined | false | ''> => Boolean(x))
              .map((row, i) => (
                <View key={row.sub}>
                  {i > 0 && <Divider inset={68} />}
                  <ListRow leadingIcon={row.icon} title={row.title} subtitle={row.sub} onPress={row.onPress} />
                </View>
              ))}
            {!student.phone && !student.email && !student.guardianName && !student.guardianPhone && !student.notes && (
              <ListRow
                leadingIcon="plus"
                title="Add contact details"
                onPress={() => router.push({ pathname: '/student/[id]/edit', params: { id } })}
              />
            )}
          </Card>
        </Section>
      </Animated.View>

      <LessonSheet lesson={selected} onClose={() => setSelected(null)} ownerId={id} />
      <View style={[styles.bottomSpace, { backgroundColor: colors.background }]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroText: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  quick: {
    alignItems: 'center',
    gap: spacing.xxs,
    minWidth: 64,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStack: {
    gap: spacing.xs,
  },
  alignStart: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: spacing.xs,
  },
  bottomSpace: {
    height: spacing.md,
  },
});
