import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { usePro, type ProFeature } from '@/billing/ProProvider';
import { FREE_LIMITS } from '@/billing/limits';
import { billingMode, loadPlans, type Plan } from '@/billing/purchases';
import { Badge, Button, Card, EmptyState, Icon, Screen, SkeletonList, Text, useSnackbar, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

const REASONS: Record<ProFeature, string> = {
  students: `The free version covers ${FREE_LIMITS.students} students. Pro has room for everyone you teach.`,
  groups: 'The free version includes one group class. With Pro, run as many as you like.',
  backup: 'Automatic backup to your own Google Drive is part of Pro.',
  reports: 'See what you earned each month, from whom, and what’s still owed.',
  pdf: 'Send clean PDF receipts and monthly statements to students and parents.',
  templates: 'Write fee reminders and receipts in your own words.',
};

const FEATURES: { icon: IconName; title: string; body: string; key: ProFeature }[] = [
  { key: 'students', icon: 'account-multiple-plus-outline', title: 'Unlimited students and groups', body: `Free covers ${FREE_LIMITS.students} students and 1 group.` },
  { key: 'backup', icon: 'cloud-upload-outline', title: 'Automatic Google Drive backup', body: 'Every change saved to your own Drive.' },
  { key: 'reports', icon: 'chart-box-outline', title: 'Income reports', body: 'Monthly earnings, by student and by method.' },
  { key: 'pdf', icon: 'file-pdf-box', title: 'PDF receipts and statements', body: 'Professional records for parents.' },
  { key: 'templates', icon: 'message-text-outline', title: 'Your own message templates', body: 'Reminders and receipts in your words.' },
];

const PERIOD: Record<Plan['kind'], string> = { yearly: 'a year', monthly: 'a month', lifetime: 'once' };
const NAME: Record<Plan['kind'], string> = { yearly: 'Yearly', monthly: 'Monthly', lifetime: 'Lifetime' };

const MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

function PlanCard({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${NAME[plan.kind]}, ${plan.price} ${PERIOD[plan.kind]}${plan.trialDays ? `, ${plan.trialDays} days free` : ''}`}
      style={[
        styles.plan,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <Icon
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        color={selected ? 'primary' : 'textTertiary'}
      />
      <View style={styles.planText}>
        <View style={styles.planTitleRow}>
          <Text variant="bodyStrong">{NAME[plan.kind]}</Text>
          {plan.kind === 'yearly' && <Badge label="Best value" tone="warning" />}
        </View>
        <Text variant="label" color="textSecondary">
          {plan.kind === 'lifetime'
            ? 'Pay once, keep Pro forever'
            : plan.trialDays
              ? `${plan.trialDays} days free, then ${plan.price} ${PERIOD[plan.kind]}`
              : `${plan.price} ${PERIOD[plan.kind]}`}
        </Text>
      </View>
      <View style={styles.planPrice}>
        <Text variant="bodyStrong">{plan.price}</Text>
        {plan.perMonth && (
          <Text variant="caption" color="textTertiary">
            {plan.perMonth}/mo
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function ProScreen() {
  const { feature } = useLocalSearchParams<{ feature?: ProFeature }>();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { isPro, buy, restorePurchases, devReset } = usePro();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPlans().then((p) => {
      if (!alive) return;
      setPlans(p);
      setSelected(p[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const plan = plans?.find((p) => p.id === selected) ?? null;

  const subscribe = async () => {
    if (!plan) return;
    const result = await buy(plan.id);
    if (result.ok) {
      router.back();
      snackbar('Welcome to Mentto Pro', { icon: 'check-decagram' });
    } else if (!result.cancelled && result.error) {
      Alert.alert('Purchase didn’t complete', result.error);
    }
  };

  const onRestore = async () => {
    const result = await restorePurchases();
    if (!result.ok) Alert.alert('Couldn’t restore', 'Check your connection and try again.');
    else if (result.isPro) {
      router.back();
      snackbar('Pro restored', { icon: 'check-decagram' });
    } else Alert.alert('Nothing to restore', 'This Google account has no Mentto Pro purchase.');
  };

  const hero = (
    <View style={styles.hero}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}>
        <Icon name="star-four-points" size={34} tint={colors.onPrimary} />
      </View>
      <Text variant="display" align="center" accessibilityRole="header">
        Mentto Pro
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        {isPro ? 'You have Pro. Thanks for supporting Mentto.' : feature ? REASONS[feature] : 'Everything you need to run your teaching, without limits.'}
      </Text>
    </View>
  );

  const features = (
    <Card padded={false}>
      {FEATURES.map((f, i) => (
        <View
          key={f.key}
          style={[
            styles.feature,
            i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
            f.key === feature && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Icon name={f.icon} color="primary" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{f.title}</Text>
            <Text variant="label" color="textSecondary">
              {f.body}
            </Text>
          </View>
          <Icon name={isPro ? 'check-circle' : 'check'} size={20} color={isPro ? 'success' : 'textTertiary'} />
        </View>
      ))}
    </Card>
  );

  if (isPro) {
    return (
      <Screen back backIcon="close" contentStyle={styles.content}>
        {hero}
        {features}
        <Button label="Manage subscription" variant="secondary" icon="open-in-new" onPress={() => Linking.openURL(MANAGE_URL)} />
        {billingMode === 'simulated' && (
          <Button label="Reset test purchase" variant="ghost" onPress={devReset} />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      back
      backIcon="close"
      contentStyle={styles.content}
      footer={
        plans && plans.length > 0 ? (
          <View style={styles.footer}>
            <Button
              label={plan?.kind === 'lifetime' ? `Buy for ${plan.price}` : plan?.trialDays ? `Start ${plan.trialDays}-day free trial` : 'Continue'}
              onPress={subscribe}
              disabled={!plan}
              fullWidth
            />
            <Text variant="caption" color="textTertiary" align="center">
              {plan?.kind === 'lifetime'
                ? 'One payment through Google Play.'
                : 'Cancel any time in Google Play. You won’t be charged if you cancel during the trial.'}
            </Text>
          </View>
        ) : undefined
      }
    >
      {hero}
      {features}

      <View style={styles.plans} accessibilityRole="radiogroup">
        {plans === null ? (
          <SkeletonList rows={3} />
        ) : plans.length === 0 ? (
          <EmptyState
            compact
            icon="wifi-off"
            title="Pro isn’t available right now"
            message="Check your connection and try again in a moment."
          />
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={styles.plans}>
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} selected={p.id === selected} onPress={() => setSelected(p.id)} />
            ))}
          </Animated.View>
        )}
      </View>

      <View style={styles.links}>
        <Button label="Restore purchases" variant="ghost" size="small" onPress={onRestore} />
        {billingMode === 'simulated' && <Badge label="Test purchases (development build)" icon="flask-outline" />}
      </View>
      <Text variant="caption" color="textTertiary" align="center">
        Your students and records stay yours, with or without Pro. If Pro ends, nothing is locked or deleted.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  plans: {
    gap: spacing.xs,
  },
  plan: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  links: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.xs,
  },
});
