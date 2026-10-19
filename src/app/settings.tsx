import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { backupNow, disableBackup, getBackupState, retryBackup, type BackupState } from '@/backup/engine';
import { formatAgo, useBackupState, useNow } from '@/backup/useBackup';
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  ListRow,
  Screen,
  Section,
  Sheet,
  SkeletonList,
  Text,
  TextField,
  useSnackbar,
  type IconName,
  type Tone,
} from '@/components/ui';
import { openPaywall, usePro } from '@/billing/ProProvider';
import { saveSettings, useSettings } from '@/db/settings';
import { exportCsv } from '@/lib/documents';
import { PRIVACY_POLICY, WEBSITE } from '@/lib/links';
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


export default function SettingsScreen() {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const [name, setName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'currency' | 'lead' | 'export' | null>(null);
  const { isPro } = usePro();
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
      <Section title="Mentto Pro">
        <Card padded={false}>
          <ListRow
            leading={
              <View style={[styles.proMark, { backgroundColor: colors.primary }]}>
                <Icon name="star-four-points" size={20} tint={colors.onPrimary} />
              </View>
            }
            title={isPro ? 'You have Pro' : 'Upgrade to Pro'}
            subtitle={
              isPro
                ? 'Thanks for supporting Mentto'
                : 'Unlimited students, Drive backup, reports, PDF receipts'
            }
            chevron
            onPress={() => router.push('/pro')}
          />
        </Card>
      </Section>

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
            leadingIcon="message-text-outline"
            title="Message templates"
            subtitle="Your own words for reminders and receipts"
            trailing={isPro ? undefined : <Badge label="Pro" tone="primary" icon="star-four-points" />}
            chevron={isPro}
            onPress={() => (isPro ? router.push('/templates') : openPaywall('templates'))}
          />
          <Divider inset={68} />
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

      <BackupSection />

      <Section title="Your data">
        <Card padded={false}>
          <ListRow
            leadingIcon="table-arrow-down"
            title="Export to a spreadsheet"
            subtitle="Students, payments or attendance as CSV"
            chevron
            onPress={() => setSheet('export')}
          />
        </Card>
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
            leadingIcon="shield-lock-outline"
            title="Privacy policy"
            subtitle="How Mentto handles your data"
            chevron
            onPress={() => Linking.openURL(PRIVACY_POLICY)}
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

      <Sheet visible={sheet === 'export'} onClose={() => setSheet(null)} title="Export to a spreadsheet">
        {(
          [
            ['students', 'account-group-outline', 'Students', 'Names, contacts and notes'],
            ['payments', 'cash-multiple', 'Payments', 'Every payment with date and method'],
            ['attendance', 'calendar-check-outline', 'Attendance', 'Every lesson marked attended or missed'],
          ] as const
        ).map(([kind, icon, title, sub]) => (
          <ListRow
            key={kind}
            leadingIcon={icon}
            title={title}
            subtitle={sub}
            onPress={() => {
              setSheet(null);
              void exportCsv(db, kind);
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

type BackupLine = { icon: IconName; text: string; badge: { label: string; tone: Tone; icon: IconName } };

function backupLine(b: BackupState, now: number): BackupLine {
  const last = b.lastBackupAt ? `Backed up ${formatAgo(b.lastBackupAt, now)}` : 'Not backed up yet';
  switch (b.phase) {
    case 'running':
      return { icon: 'cloud-sync-outline', text: 'Backing up…', badge: { label: 'Syncing', tone: 'primary', icon: 'sync' } };
    case 'offline':
      return { icon: 'cloud-off-outline', text: 'Waiting for internet', badge: { label: 'Offline', tone: 'warning', icon: 'wifi-off' } };
    case 'error':
      return {
        icon: 'cloud-alert-outline',
        text: 'Backup failed – tap to retry',
        badge: { label: 'Failed', tone: 'danger', icon: 'alert-circle-outline' },
      };
    case 'conflict':
      return {
        icon: 'cloud-alert-outline',
        text: 'Another phone has a newer backup – tap to review',
        badge: { label: 'Check', tone: 'warning', icon: 'alert-outline' },
      };
    case 'signedOut':
      return {
        icon: 'cloud-lock-outline',
        text: 'Signed out of Google – tap to sign in',
        badge: { label: 'Paused', tone: 'warning', icon: 'pause' },
      };
    default:
      return { icon: 'cloud-check-outline', text: last, badge: { label: 'On', tone: 'success', icon: 'check' } };
  }
}

function BackupSection() {
  const { isPro } = usePro();
  const backup = useBackupState();
  const now = useNow();
  const snackbar = useSnackbar();
  const [confirmOff, setConfirmOff] = useState(false);

  if (!backup.ready) {
    return (
      <Section title="Backup">
        <SkeletonList rows={1} />
      </Section>
    );
  }

  if (backup.phase === 'off') {
    return (
      <Section title="Backup">
        <Card padded={false}>
          <ListRow
            leadingIcon="cloud-upload-outline"
            title="Google Drive backup"
            subtitle="Back up automatically to your own Drive"
            trailing={isPro ? <Badge label="Turn on" tone="primary" /> : <Badge label="Pro" tone="primary" icon="star-four-points" />}
            onPress={() => (isPro ? router.push('/backup') : openPaywall('backup'))}
          />
        </Card>
        <Text variant="caption" color="textTertiary" style={styles.note}>
          Android also includes Mentto in your phone’s own Google backup when it’s turned on.
        </Text>
      </Section>
    );
  }

  // Backup was set up, but Pro has ended: automatic backups pause; restoring still works.
  const line: BackupLine = isPro
    ? backupLine(backup, now)
    : {
        icon: 'cloud-off-outline',
        text: 'Paused. Automatic backup is part of Pro.',
        badge: { label: 'Pro', tone: 'primary', icon: 'star-four-points' },
      };
  const onStatus = !isPro
    ? () => openPaywall('backup')
    : backup.phase === 'error' || backup.phase === 'offline'
      ? retryBackup
      : backup.phase === 'conflict' || backup.phase === 'signedOut'
        ? () => router.push('/backup')
        : undefined;

  const backUp = async () => {
    await backupNow({ force: true });
    const after = getBackupState();
    if (after.phase === 'idle') snackbar('Backed up', { icon: 'check-circle-outline' });
  };

  return (
    <Section title="Backup">
      <Card padded={false}>
        <ListRow
          leadingIcon={line.icon}
          title={backup.account ?? 'Google Drive backup'}
          subtitle={line.text}
          trailing={<Badge {...line.badge} />}
          onPress={onStatus}
        />
        <View style={styles.backupActions}>
          <Button
            label="Back up now"
            icon="cloud-upload-outline"
            variant="secondary"
            size="small"
            onPress={isPro ? backUp : () => openPaywall('backup')}
            loading={backup.phase === 'running'}
            disabled={isPro && (backup.phase === 'signedOut' || backup.phase === 'conflict')}
          />
          <Button label="Restore…" icon="backup-restore" variant="ghost" size="small" onPress={() => router.push('/backup')} />
        </View>
        <Divider inset={68} />
        <ListRow leadingIcon="cloud-remove-outline" title="Turn off backup" destructive onPress={() => setConfirmOff(true)} />
      </Card>
      <Text variant="caption" color="textTertiary" style={styles.note}>
        Backs up a minute after changes, into a private Mentto folder in your Drive.
      </Text>

      <Sheet visible={confirmOff} onClose={() => setConfirmOff(false)} title="Turn off backup?">
        <View style={styles.sheetBody}>
          <Text variant="body" color="textSecondary">
            New changes won’t be backed up. Backups already in your Drive stay there, and you can restore them after signing in again.
          </Text>
          <Button
            label="Turn off"
            variant="danger"
            onPress={async () => {
              setConfirmOff(false);
              await disableBackup();
            }}
            fullWidth
          />
          <Button label="Cancel" variant="ghost" onPress={() => setConfirmOff(false)} fullWidth />
        </View>
      </Sheet>
    </Section>
  );
}

const styles = StyleSheet.create({
  backupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetBody: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  content: {
    paddingTop: spacing.sm,
  },
  note: {
    paddingHorizontal: spacing.xxs,
  },
  proMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.md,
  },
});
