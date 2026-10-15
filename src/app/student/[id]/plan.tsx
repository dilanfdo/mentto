import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  DateField,
  Icon,
  Screen,
  SegmentedControl,
  SkeletonList,
  Text,
  TextField,
  useSnackbar,
} from '@/components/ui';
import { useQuery } from '@/db/core';
import { currentPlan, endPlan, listPlans, savePlan, type FeeKind, type FeePlan } from '@/db/fees';
import { getSettings } from '@/db/settings';
import { getStudent, type Student } from '@/db/students';
import { nextMonthlyCharge } from '@/domain/fees';
import { formatShortDate, ordinal, parseDate, today } from '@/lib/dates';
import { currencySymbol, formatMoney, parseMoney, toMoneyInput } from '@/lib/money';
import { spacing } from '@/theme';

export default function PlanForm() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading } = useQuery(
    async (d) => {
      const [student, settings, plans] = await Promise.all([getStudent(d, id), getSettings(d), listPlans(d, id)]);
      return { student, settings, plan: currentPlan(plans) };
    },
    [id],
  );

  if (loading && !data) {
    return (
      <Screen title="Fee plan" back backIcon="close">
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (!data?.student) return null;
  return <PlanBody id={id} student={data.student} plan={data.plan} defaultCurrency={data.settings.currency} />;
}

type BodyProps = { id: string; student: Student; plan: FeePlan | null; defaultCurrency: string };

function PlanBody({ id, student, plan, defaultCurrency }: BodyProps) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  // A change normally applies from the next due date, leaving past charges alone.
  const next = nextMonthlyCharge(plan, today());

  const [kind, setKind] = useState<FeeKind>(plan?.kind ?? 'monthly');
  const [amount, setAmount] = useState(plan ? toMoneyInput(plan.amount, plan.currency) : '');
  const [startsOn, setStartsOn] = useState(plan?.kind === 'monthly' && next ? next.date : today());
  const [error, setError] = useState<string | null>(null);

  const currency = plan?.currency ?? defaultCurrency;
  const firstName = student.name.split(' ')[0];
  const parsed = parseMoney(amount, currency);
  const day = Math.min(parseDate(startsOn).getDate(), 28);

  const preview =
    parsed && parsed > 0
      ? kind === 'monthly'
        ? `${formatMoney(parsed, currency)} is added on the ${ordinal(day)} of every month, starting ${formatShortDate(startsOn)}.`
        : `${formatMoney(parsed, currency)} is added for every lesson ${firstName} attends from ${formatShortDate(startsOn)}. Missed and cancelled lessons aren’t charged.`
      : null;

  const save = async () => {
    if (!parsed || parsed <= 0) {
      setError('Enter an amount');
      return;
    }
    await savePlan(db, id, { kind, amount: parsed, currency, startsOn });
    router.back();
    snackbar('Fee plan saved', { icon: 'check-circle-outline' });
  };

  const stop = () => {
    if (!plan) return;
    Alert.alert('Stop charging?', 'No new fees are added after today. Anything already owed stays on the balance.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop charging',
        style: 'destructive',
        onPress: async () => {
          await endPlan(db, plan);
          router.back();
          snackbar('Fee plan stopped', { icon: 'information-outline' });
        },
      },
    ]);
  };

  return (
    <Screen
      title={plan ? 'Change fee plan' : `Fees for ${firstName}`}
      back
      backIcon="close"
      footer={<Button label="Save plan" onPress={save} fullWidth />}
      contentStyle={styles.content}
    >
      <SegmentedControl
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'per_session', label: 'Per lesson' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setError(null);
        }}
      />

      <TextField
        label={kind === 'monthly' ? 'Monthly fee' : 'Fee per lesson'}
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          setError(null);
        }}
        error={error}
        prefix={currencySymbol(currency)}
        keyboardType="decimal-pad"
        placeholder="0"
        autoFocus={!plan}
      />

      <DateField
        label={plan ? 'Applies from' : kind === 'monthly' ? 'First payment due' : 'Charge lessons from'}
        value={startsOn}
        onChange={setStartsOn}
        hint={
          kind === 'monthly'
            ? parseDate(startsOn).getDate() > 28
              ? 'Later months fall due on the 28th so every month has the date.'
              : 'Fees fall due on this day each month.'
            : undefined
        }
      />

      {preview && (
        <Card>
          <View style={styles.preview}>
            <Icon name="information-outline" size={20} color="primary" />
            <Text variant="label" color="textSecondary" style={styles.flex}>
              {preview}
              {plan ? ' Earlier charges keep their old price.' : ''}
            </Text>
          </View>
        </Card>
      )}

      {plan && (
        <Button label="Stop charging" icon="cancel" variant="danger" onPress={stop} style={styles.stop} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  preview: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  stop: {
    marginTop: spacing.sm,
  },
});
