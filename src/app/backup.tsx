import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignInCancelled } from '@/backup/account';
import type { DriveBackup } from '@/backup/drive';
import { enableBackup, fetchBackups, isThisDevice, keepThisPhone, restoreBackup } from '@/backup/engine';
import { RestoreError } from '@/backup/snapshot';
import { formatAgo, formatBackupDate, useBackupState, useNow } from '@/backup/useBackup';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  Section,
  Sheet,
  SkeletonList,
  Text,
  useSnackbar,
} from '@/components/ui';
import { spacing } from '@/theme';

type List = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; backups: DriveBackup[] };

const describe = (b: DriveBackup) => {
  const n = Number(b.props.students ?? NaN);
  return [
    isThisDevice(b) ? 'This phone' : (b.props.deviceName ?? 'Another phone'),
    Number.isFinite(n) ? `${n} ${n === 1 ? 'student' : 'students'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

/** Turns on Drive backup and lists the versions there to restore from. */
export default function BackupScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === 'onboarding';
  const backup = useBackupState();
  const signedIn = backup.phase !== 'off' && backup.phase !== 'signedOut';
  const [list, setList] = useState<List>({ status: 'loading' });
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const fetchList = useCallback(
    () =>
      fetchBackups().then(
        (backups): List => ({ status: 'ready', backups }),
        (e): List => {
          console.warn('Could not list backups', e);
          return { status: 'error', message: 'Couldn’t reach Google Drive. Check your connection and try again.' };
        },
      ),
    [],
  );

  useEffect(() => {
    if (!backup.ready || !signedIn) return;
    let live = true;
    fetchList().then((l) => live && setList(l));
    return () => {
      live = false;
    };
    // Re-read after each backup so the first one shows up as soon as it lands.
  }, [backup.ready, signedIn, backup.lastBackupAt, fetchList]);

  const reload = () => {
    setList({ status: 'loading' });
    fetchList().then(setList);
  };

  const signIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      setList({ status: 'ready', backups: await enableBackup() });
    } catch (e) {
      if (!(e instanceof SignInCancelled)) {
        console.warn('Google sign-in failed', e);
        setSignInError('Couldn’t sign in to Google. Check your connection and try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (!signedIn) {
    return (
      <Screen
        title={onboarding ? 'Restore' : 'Google Drive backup'}
        back
        backIcon="close"
        footer={<Button label="Sign in with Google" icon="google" onPress={signIn} loading={signingIn} fullWidth />}
      >
        <EmptyState
          icon="cloud-lock-outline"
          title={backup.phase === 'signedOut' ? 'Sign in again to keep backing up' : 'Back up to your own Google Drive'}
          message={
            'Mentto saves a copy of your records in a private app folder in your Drive a minute after you make changes. ' +
            'It can’t see your other Drive files, and only this app can read the folder.'
          }
        />
        {signInError && (
          <Text variant="label" color="danger" align="center">
            {signInError}
          </Text>
        )}
      </Screen>
    );
  }

  return <Versions list={list} reload={reload} onboarding={onboarding} />;
}

function Versions({ list, reload, onboarding }: { list: List; reload: () => void; onboarding: boolean }) {
  const backup = useBackupState();
  const snackbar = useSnackbar();
  const now = useNow();
  const [confirm, setConfirm] = useState<DriveBackup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const backups = list.status === 'ready' ? list.backups : [];
  const newest = backups[0];
  // Offer the newest backup up front on a fresh install, or when another phone backed up since.
  const offer = newest && (backup.conflict?.id === newest.id || (backup.lastBackupAt === null && !isThisDevice(newest)))
    ? newest
    : null;

  const restore = async (b: DriveBackup) => {
    setRestoring(true);
    setRestoreError(null);
    try {
      await restoreBackup(b);
      setConfirm(null);
      snackbar(`Restored the backup from ${formatBackupDate(b.createdTime)}`, { icon: 'check-circle-outline' });
      if (onboarding) router.replace('/');
      else router.back();
    } catch (e) {
      console.warn('Restore failed', e);
      setRestoreError(e instanceof RestoreError ? e.message : 'Couldn’t restore this backup. Check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  };

  const keep = async () => {
    setKeeping(true);
    try {
      const fresh = backup.lastBackupAt === null;
      await keepThisPhone();
      if (!fresh) snackbar('Kept this phone’s data and backed it up', { icon: 'check-circle-outline' });
      router.back();
    } finally {
      setKeeping(false);
    }
  };

  return (
    <Screen title={onboarding ? 'Restore' : 'Backups'} back backIcon="close" contentStyle={styles.content}>
      {offer && (
        <Card>
          <View style={styles.offer}>
            <Text variant="title">Found a backup from {formatBackupDate(offer.createdTime)}</Text>
            <Text variant="body" color="textSecondary">
              {backup.lastBackupAt !== null
                ? `${describe(offer)}. It’s newer than this phone’s last backup. Restore it, or keep what’s on this phone and back that up instead.`
                : `${describe(offer)}. Restore it to pick up where you left off?`}
            </Text>
            <View style={styles.offerActions}>
              <Button label="Restore" icon="backup-restore" onPress={() => setConfirm(offer)} fullWidth />
              {backup.conflict && (
                <Button
                  label={backup.lastBackupAt !== null ? 'Keep this phone’s data' : 'Start fresh'}
                  variant="secondary"
                  onPress={keep}
                  loading={keeping}
                  fullWidth
                />
              )}
            </View>
          </View>
        </Card>
      )}

      <Section title="Versions in your Drive">
        {list.status === 'loading' && <SkeletonList rows={3} />}
        {list.status === 'error' && (
          <ErrorState message={list.message} retry={<Button label="Try again" variant="secondary" onPress={reload} />} />
        )}
        {list.status === 'ready' && backups.length === 0 && (
          <EmptyState
            compact
            icon="cloud-outline"
            title="No backups yet"
            message="Your first backup is on its way. Older versions will show up here."
          />
        )}
        {backups.length > 0 && (
          <Card padded={false}>
            {backups.map((b, i) => (
              <View key={b.id}>
                {i > 0 && <Divider inset={68} />}
                <ListRow
                  leadingIcon={isThisDevice(b) ? 'cellphone' : 'cellphone-arrow-down'}
                  title={formatBackupDate(b.createdTime)}
                  subtitle={`${describe(b)} · ${formatAgo(b.createdTime, now)}`}
                  trailing={i === 0 ? <Badge label="Latest" tone="primary" icon="star-outline" /> : undefined}
                  chevron
                  onPress={() => setConfirm(b)}
                  accessibilityHint="Restores this version"
                />
              </View>
            ))}
          </Card>
        )}
        <Text variant="caption" color="textTertiary" style={styles.note}>
          Mentto keeps the latest backup, one a day for a week and one a week for a month.
        </Text>
      </Section>

      <Sheet
        visible={confirm !== null}
        onClose={() => !restoring && setConfirm(null)}
        title="Restore this backup?"
        subtitle={confirm ? `${formatBackupDate(confirm.createdTime)} · ${describe(confirm)}` : undefined}
      >
        <View style={styles.sheet}>
          <Text variant="body" color="textSecondary">
            Everything on this phone will be replaced with this backup. Changes made since then will be lost.
          </Text>
          {restoreError && (
            <Text variant="label" color="danger">
              {restoreError}
            </Text>
          )}
          <Button label="Restore" icon="backup-restore" onPress={() => confirm && restore(confirm)} loading={restoring} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={() => setConfirm(null)} disabled={restoring} fullWidth />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
  },
  offer: {
    gap: spacing.sm,
  },
  offerActions: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  note: {
    paddingHorizontal: spacing.xxs,
  },
  sheet: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
