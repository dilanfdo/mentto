import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import {
  Badge,
  Card,
  Divider,
  ListRow,
  Screen,
  Section,
  Sheet,
  SkeletonList,
  Text,
  TextField,
  useSnackbar,
} from '@/components/ui';
import { saveSettings, useSettings } from '@/db/settings';
import { COMMON_CURRENCIES, currencyLabel } from '@/lib/money';
import { requestPermission } from '@/notifications/reminders';
import { useReminderAccess } from '@/notifications/useReminderAccess';
import { openExactAlarmSettings } from '@modules/exact-alarms';
import { spacing, useTheme } from '@/theme';

const LEAD_TIMES = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
];

const WEBSITE = 'https://nexusdigitallabs.dev/mentto/';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const [name, setName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'currency' | 'lead' | null>(null);
  const access = useReminderAccess();
  const permission = access.notifications ?? 'undetermined';

  if (!settings) {
    return (
      <Screen title="Settings" back>
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  const saveName = async () => {
    if (name === null || name.trim() === settings.tutorName) return;
    await saveSettings(db, { tutorName: name.trim() });
    snackbar('Name saved', { icon: 'check-circle-outline' });
  };

  const allowNotifications = async () => {
    if (permission === 'denied') {
      Linking.openSettings();
      return;
    }
    access.setNotifications(await requestPermission());
  };

  const currencies = [settings.currency, ...COMMON_CURRENCIES.filter((c) => c !== settings.currency)];
  const lead = LEAD_TIMES.find((l) => l.value === settings.lessonReminderMin) ?? LEAD_TIMES[2];

  return (
    <Screen title="Settings" back contentStyle={styles.content}>
      <Section title="You">
        <TextField
          label="Your name"
          optional
          value={name ?? settings.tutorName}
          onChangeText={setName}
          onBlur={saveName}
          onSubmitEditing={saveName}
          returnKeyType="done"
          autoCapitalize="words"
          hint="Signs the reminders and receipts you send."
        />
        <Card padded={false}>
          <ListRow
            leadingIcon="cash"
            title="Currency"
            subtitle={`${currencyLabel(settings.currency)} · used for new fee plans`}
            chevron
            onPress={() => setSheet('currency')}
          />
        </Card>
      </Section>

      <Section title="Reminders">
        <Card padded={false}>
          {permission !== 'granted' && (
            <>
              <ListRow
                leadingIcon="bell-off-outline"
                title="Notifications are off"
                subtitle={
                  permission === 'denied'
                    ? 'Turn them on for Mentto in Android settings.'
                    : 'Allow notifications so reminders can reach you.'
                }
                trailing={<Badge label={permission === 'denied' ? 'Open settings' : 'Allow'} tone="primary" />}
                onPress={allowNotifications}
              />
              <Divider inset={68} />
            </>
          )}
          {permission === 'granted' && !access.exact && (
            <>
              <ListRow
                leadingIcon="clock-alert-outline"
                title="Reminders may arrive late"
                subtitle="Allow “Alarms & reminders” so Android delivers them on time."
                trailing={<Badge label="Allow" tone="primary" />}
                onPress={openExactAlarmSettings}
              />
              <Divider inset={68} />
            </>
          )}
          <ListRow
            leadingIcon="calendar-clock"
            title="Before each lesson"
            subtitle={lead.label}
            chevron
            onPress={() => setSheet('lead')}
          />
          <Divider inset={68} />
          <ListRow
            leadingIcon="wallet-outline"
            title="When a fee is due"
            subtitle="9:00 AM on the due date"
            trailing={
              <Switch
                value={settings.feeReminders}
                onValueChange={(v) => saveSettings(db, { feeReminders: v })}
                trackColor={{ true: colors.primary, false: colors.borderStrong }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Fee due reminders"
              />
            }
          />
        </Card>
      </Section>

      <Section title="Backup">
        <Card padded={false}>
          <ListRow
            leadingIcon="cloud-upload-outline"
            title="Google Drive backup"
            subtitle="Automatic backup to your own Drive"
            trailing={<Badge label="Coming soon" />}
          />
        </Card>
        <Text variant="caption" color="textTertiary" style={styles.note}>
          Until then, Android includes Mentto in your phone’s own Google backup when it’s turned on.
        </Text>
      </Section>

      <Section title="About">
        <Card padded={false}>
          <ListRow
            leadingIcon="web"
            title="Mentto website"
            subtitle="nexusdigitallabs.dev/mentto"
            chevron
            onPress={() => Linking.openURL(WEBSITE)}
          />
          <Divider inset={68} />
          <ListRow
            leadingIcon="information-outline"
            title="Version"
            subtitle={Constants.expoConfig?.version ?? '1.0.0'}
          />
        </Card>
        <View style={styles.footer}>
          <Text variant="caption" color="textTertiary" align="center">
            Made by NexusDigitalLabs
          </Text>
        </View>
      </Section>

      <Sheet visible={sheet === 'currency'} onClose={() => setSheet(null)} title="Currency">
        {currencies.map((c) => (
          <ListRow
            key={c}
            title={currencyLabel(c)}
            trailing={c === settings.currency ? <Badge label="Current" tone="primary" icon="check" /> : undefined}
            onPress={async () => {
              setSheet(null);
              await saveSettings(db, { currency: c });
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'lead'} onClose={() => setSheet(null)} title="Lesson reminders">
        {LEAD_TIMES.map((l) => (
          <ListRow
            key={l.value}
            title={l.label}
            trailing={l.value === settings.lessonReminderMin ? <Badge label="On" tone="primary" icon="check" /> : undefined}
            onPress={async () => {
              setSheet(null);
              await saveSettings(db, { lessonReminderMin: l.value });
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
  },
  note: {
    paddingHorizontal: spacing.xxs,
  },
  footer: {
    paddingTop: spacing.md,
  },
});
