import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Button, ChipGroup, Icon, Screen, Text, TextField, type IconName } from '@/components/ui';
import { defaultCurrency, saveSettings } from '@/db/settings';
import { COMMON_CURRENCIES, currencyLabel } from '@/lib/money';
import { requestPermission } from '@/notifications/reminders';
import { radii, spacing, useTheme } from '@/theme';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'calendar-blank-outline', title: 'Lessons that repeat', body: 'Set a weekly slot once. Move or cancel a single lesson any time.' },
  { icon: 'wallet-outline', title: 'Fees that add up', body: 'Monthly or per-lesson plans, payments and who still owes.' },
  { icon: 'bell-outline', title: 'Reminders before it matters', body: 'A heads-up before each class and when a fee falls due.' },
];

const STEPS = 3;

export default function Onboarding() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const detected = defaultCurrency();
  const [currency, setCurrency] = useState(detected);
  const currencies = [detected, ...COMMON_CURRENCIES.filter((c) => c !== detected)];

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 0) return false;
        setStep((s) => s - 1);
        return true;
      });
      return () => sub.remove();
    }, [step]),
  );

  const finish = async (askForReminders: boolean) => {
    if (askForReminders) await requestPermission();
    await saveSettings(db, { onboarded: true, tutorName: name.trim(), currency });
    router.replace('/today');
  };

  const progress = (
    <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i === step ? colors.primary : colors.border, width: i === step ? 24 : 8 },
          ]}
        />
      ))}
    </View>
  );

  return (
    <Screen
      back={step > 0 ? () => setStep(step - 1) : undefined}
      actions={progress}
      footer={
        step === 0 ? (
          <Button label="Get started" onPress={() => setStep(1)} fullWidth />
        ) : step === 1 ? (
          <Button label="Continue" onPress={() => setStep(2)} fullWidth />
        ) : (
          <View style={styles.footerStack}>
            <Button label="Turn on reminders" icon="bell-ring-outline" onPress={() => finish(true)} fullWidth />
            <Button label="Not now" variant="ghost" onPress={() => finish(false)} fullWidth />
          </View>
        )
      }
    >
      <Animated.View key={step} entering={FadeInRight.duration(260)} style={styles.step}>
        {step === 0 && (
          <>
            <View style={[styles.mark, { backgroundColor: colors.primary }]}>
              <Icon name="school-outline" size={34} tint={colors.onPrimary} />
            </View>
            <View style={styles.heading}>
              <Text variant="display" accessibilityRole="header">
                You teach.{'\n'}
                <Text variant="display" color="primary">
                  Mentto keeps track.
                </Text>
              </Text>
              <Text variant="body" color="textSecondary">
                Students, lessons and fees for independent tutors and coaches, all in one place.
              </Text>
            </View>
            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.feature}>
                  <View style={[styles.featureIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name={f.icon} size={22} color="onPrimarySoft" />
                  </View>
                  <View style={styles.featureText}>
                    <Text variant="bodyStrong">{f.title}</Text>
                    <Text variant="label" color="textSecondary">
                      {f.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.privacy}>
              <Icon name="shield-check-outline" size={16} color="textTertiary" />
              <Text variant="caption" color="textTertiary">
                No account needed. Your records stay on this phone.
              </Text>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <View style={styles.heading}>
              <Text variant="display" accessibilityRole="header">
                A couple of details
              </Text>
              <Text variant="body" color="textSecondary">
                You can change these later in Settings.
              </Text>
            </View>
            <TextField
              label="Your name"
              optional
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ms. Perera"
              autoCapitalize="words"
              returnKeyType="done"
              hint="Used to sign fee reminders you send to students."
            />
            <View style={styles.group}>
              <Text variant="labelStrong" color="textSecondary">
                Currency for fees
              </Text>
              <ChipGroup
                options={currencies.map((c) => ({ value: c, label: currencyLabel(c) }))}
                value={currency}
                onChange={setCurrency}
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={[styles.mark, { backgroundColor: colors.primarySoft }]}>
              <Icon name="bell-ring-outline" size={34} color="onPrimarySoft" />
            </View>
            <View style={styles.heading}>
              <Text variant="display" accessibilityRole="header">
                Never miss a lesson or a fee
              </Text>
              <Text variant="body" color="textSecondary">
                Mentto can remind you 30 minutes before each lesson and on the morning a fee is due. Android will ask
                for permission to show notifications.
              </Text>
            </View>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    gap: spacing.xs,
  },
  features: {
    gap: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  group: {
    gap: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xxs,
    paddingRight: spacing.md,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footerStack: {
    gap: spacing.xxs,
  },
});
