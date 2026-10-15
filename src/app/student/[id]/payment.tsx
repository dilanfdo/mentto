import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  ChipGroup,
  DateField,
  Screen,
  SkeletonList,
  Text,
  TextField,
  useSnackbar,
} from '@/components/ui';
import { useQuery } from '@/db/core';
import { createPayment, type PaymentMethod } from '@/db/fees';
import { getSettings } from '@/db/settings';
import { getStudent, type Student } from '@/db/students';
import { loadFeeStatus, type FeeStatus } from '@/domain/fees';
import { shareText } from '@/lib/contact';
import { formatShortDate, today } from '@/lib/dates';
import { currencySymbol, formatMoney, parseMoney, toMoneyInput } from '@/lib/money';
import { METHOD_LABELS } from '@/lib/summaries';
import { spacing } from '@/theme';

const METHODS: PaymentMethod[] = ['cash', 'bank', 'card', 'other'];

export default function PaymentForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useQuery(
    async (d) => {
      const settings = await getSettings(d);
      const [student, fee] = await Promise.all([getStudent(d, id), loadFeeStatus(d, id, settings.currency)]);
      return { student, fee, settings };
    },
    [id],
  );

  if (loading && !data) {
    return (
      <Screen title="Record payment" back backIcon="close">
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (!data?.student) return null;
  return <PaymentBody id={id} student={data.student} fee={data.fee} tutorName={data.settings.tutorName} />;
}

type BodyProps = { id: string; student: Student; fee: FeeStatus; tutorName: string };

function PaymentBody({ id, student, fee, tutorName }: BodyProps) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const currency = fee.currency;
  const suggested = fee.balance > 0 ? fee.balance : (fee.nextDue?.amount ?? fee.plan?.amount ?? 0);

  const [amount, setAmount] = useState(suggested > 0 ? toMoneyInput(suggested, currency) : '');
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = parseMoney(amount, currency);
  const owed = fee.balance > 0 ? fee.balance : 0;

  const save = async () => {
    if (!parsed || parsed <= 0) {
      setError('Enter the amount received');
      return;
    }
    await createPayment(db, id, { amount: parsed, currency, paidOn, method, note });
    router.back();
    const receipt =
      `Payment received – thank you!\n\n` +
      `Student: ${student.name}\nAmount: ${formatMoney(parsed, currency)}\nDate: ${formatShortDate(paidOn)}\n` +
      `Method: ${METHOD_LABELS[method]}` +
      (note.trim() ? `\nNote: ${note.trim()}` : '') +
      (tutorName ? `\n\n– ${tutorName}` : '');
    snackbar(`${formatMoney(parsed, currency)} from ${student.name.split(' ')[0]} recorded`, {
      icon: 'check-circle-outline',
      action: { label: 'Send receipt', onPress: () => shareText(receipt) },
    });
  };

  return (
    <Screen
      title="Record payment"
      back
      backIcon="close"
      footer={<Button label="Save payment" onPress={save} fullWidth />}
      contentStyle={styles.content}
    >
      <View style={styles.who}>
        <Avatar name={student.name} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{student.name}</Text>
          <Text variant="label" color="textSecondary">
            {owed > 0 ? `Owes ${formatMoney(owed, currency)}` : fee.balance < 0 ? `${formatMoney(-fee.balance, currency)} in credit` : 'All paid up'}
          </Text>
        </View>
      </View>

      <TextField
        label="Amount received"
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          setError(null);
        }}
        error={error}
        prefix={currencySymbol(currency)}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={
          parsed && owed > 0 && parsed > owed
            ? `${formatMoney(parsed - owed, currency)} more than owed; it’s kept as credit.`
            : undefined
        }
      />

      <DateField label="Date" value={paidOn} onChange={setPaidOn} maximumDate={today()} />

      <View style={styles.group}>
        <Text variant="labelStrong" color="textSecondary">
          Paid by
        </Text>
        <ChipGroup
          options={METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
          value={method}
          onChange={setMethod}
        />
      </View>

      <TextField label="Note" optional value={note} onChangeText={setNote} placeholder="e.g. October fee" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  group: {
    gap: spacing.xs,
  },
});
