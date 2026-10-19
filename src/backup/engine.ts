// The auto-backup: after edits settle (or when the app goes to the background) it snapshots the
// database and uploads it to the tutor's Drive app folder, then prunes old versions. Progress is
// tracked by meta.change_seq, which every write() bumps; backup bookkeeping is written to meta
// directly so it never marks the data dirty itself.

import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { exclusive, newId, type DB } from '@/db/core';
import { SCHEMA_VERSION } from '@/db/schema';

import * as account from './account';
import { DriveError, deleteBackup, downloadBackup, listBackups, uploadBackup, type DriveBackup } from './drive';
import { backupsToPrune } from './retention';
import { createSnapshot, restoreSnapshot } from './snapshot';

export type BackupPhase =
  | 'off' // never set up, or turned off
  | 'signedOut' // set up, but Google needs a fresh sign-in
  | 'idle' // everything is backed up
  | 'pending' // changes waiting for the debounce
  | 'running'
  | 'offline' // changes waiting for a connection
  | 'error'
  | 'conflict'; // another phone made a newer backup

export type BackupState = {
  ready: boolean;
  phase: BackupPhase;
  account: string | null;
  lastBackupAt: string | null;
  error: string | null;
  /** The other phone's newer backup, while phase is 'conflict'. */
  conflict: DriveBackup | null;
};

const DEBOUNCE_MS = 45_000;

let db: DB | null = null;
let deviceId = '';
let lastSeq = 0;
let ackFile: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let rerun = false;

let state: BackupState = { ready: false, phase: 'off', account: null, lastBackupAt: null, error: null, conflict: null };
const listeners = new Set<() => void>();

function set(patch: Partial<BackupState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getBackupState = () => state;
export function subscribeToBackup(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function getMeta(key: string): Promise<string | null> {
  const row = await db!.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

function setMeta(values: Record<string, string | null>): Promise<void> {
  return exclusive(() => saveMeta(values));
}

async function saveMeta(values: Record<string, string | null>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) await db!.runAsync('DELETE FROM meta WHERE key = ?', key);
    else {
      await db!.runAsync(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        value,
      );
    }
  }
}

async function currentSeq(): Promise<number> {
  return Number((await getMeta('change_seq')) ?? 0);
}

function deviceName(): string {
  if (Platform.OS === 'android') {
    const c = Platform.constants as { Manufacturer?: string; Model?: string };
    return [c.Manufacturer, c.Model].filter(Boolean).join(' ').slice(0, 60) || 'Android phone';
  }
  return Platform.OS;
}

/** A backup from another install that is newer than anything this phone has seen. */
function isForeign(b: DriveBackup | undefined): b is DriveBackup {
  if (!b || b.props.deviceId === deviceId || b.id === ackFile) return false;
  return !state.lastBackupAt || b.createdTime > state.lastBackupAt;
}

/** Runs `fn` with an access token, retrying once with a fresh token if Drive rejects it. */
async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await account.getAccessToken();
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof DriveError && e.status === 401) return fn(await account.getAccessToken(token));
    throw e;
  }
}

async function isOnline(): Promise<boolean> {
  const net = await NetInfo.fetch();
  return net.isConnected !== false && net.isInternetReachable !== false;
}

async function failed(e: unknown) {
  if (e instanceof account.NotSignedIn) {
    set({ phase: 'signedOut', error: e.message });
  } else if (!(e instanceof DriveError) && !(await isOnline())) {
    set({ phase: 'offline', error: null });
  } else {
    console.warn('Backup failed', e);
    set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Loads saved backup state and reconnects to Google. Called once the database is open. */
export async function startBackup(database: DB): Promise<void> {
  db = database;
  deviceId = (await getMeta('device_id')) ?? '';
  if (!deviceId) {
    deviceId = newId();
    await setMeta({ device_id: deviceId });
  }
  lastSeq = Number((await getMeta('last_backup_seq')) ?? 0);
  ackFile = await getMeta('backup_ack_file');
  const enabled = (await getMeta('backup_enabled')) === '1';
  set({
    ready: true,
    phase: enabled ? 'idle' : 'off',
    account: await getMeta('backup_account'),
    lastBackupAt: await getMeta('last_backup_at'),
  });
  if (!enabled) return;
  try {
    const email = await account.restoreSignIn();
    if (!email) {
      set({ phase: 'signedOut' });
      return;
    }
    set({ account: email });
  } catch (e) {
    // Offline or Play services hiccup: keep the saved account and retry with the next backup.
    console.warn('Could not restore Google sign-in', e);
  }
  await backupNow();
}

/** Automatic backup is a Pro feature; restoring never is. Set by BackupSync from the entitlement. */
let allowed = false;

export function setBackupAllowed(value: boolean): void {
  const was = allowed;
  allowed = value;
  if (value && !was) void backupNow();
}

const enabled = () => allowed && db !== null && state.phase !== 'off' && state.phase !== 'signedOut';

/** Call after any data change: backs up once edits have been quiet for a while. */
export function scheduleBackup(): void {
  if (!enabled()) return;
  clearTimeout(timer);
  if (state.phase === 'idle') set({ phase: 'pending' });
  timer = setTimeout(() => void backupNow(), DEBOUNCE_MS);
}

/** Backs up now if anything changed (or always, with `force`). Safe to call repeatedly. */
export function backupNow(opts: { force?: boolean } = {}): Promise<void> {
  clearTimeout(timer);
  if (!enabled()) return Promise.resolve();
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = run(opts.force ?? false).finally(() => {
    inFlight = null;
    if (rerun) {
      rerun = false;
      void backupNow();
    }
  });
  return inFlight;
}

async function run(force: boolean): Promise<void> {
  const seq = await currentSeq();
  if (!force && seq <= lastSeq && state.phase !== 'conflict') {
    set({ phase: 'idle', error: null });
    return;
  }
  if (!(await isOnline())) {
    set({ phase: 'offline', error: null });
    return;
  }
  set({ phase: 'running', error: null });
  try {
    await withToken(async (token) => {
      const existing = await listBackups(token);
      if (isForeign(existing[0])) {
        set({ phase: 'conflict', conflict: existing[0] });
        return;
      }
      const snap = await createSnapshot(db!);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uploaded = await uploadBackup(token, `mentto-${stamp}.db.gz`, snap.data, {
        deviceId,
        deviceName: deviceName(),
        changeSeq: String(snap.changeSeq),
        schemaVersion: String(SCHEMA_VERSION),
        students: String(snap.students),
      });
      lastSeq = snap.changeSeq;
      await setMeta({ last_backup_seq: String(lastSeq), last_backup_at: uploaded.createdTime });
      set({ lastBackupAt: uploaded.createdTime, conflict: null });

      for (const old of backupsToPrune([uploaded, ...existing])) {
        await deleteBackup(token, old.id).catch((e) => console.warn('Could not prune backup', e));
      }
      set({ phase: (await currentSeq()) > lastSeq ? 'pending' : 'idle' });
    });
    if (state.phase === 'pending') scheduleBackup();
  } catch (e) {
    await failed(e);
  }
}

/** Retries after the app returns or the connection comes back, if something is waiting. */
export function retryBackup(): void {
  if (!enabled() || state.phase === 'conflict' || state.phase === 'running') return;
  void backupNow();
}

/** Signs in and turns backup on. Returns the backups already in Drive, newest first. */
export async function enableBackup(): Promise<DriveBackup[]> {
  const email = await account.signIn();
  await setMeta({ backup_enabled: '1', backup_account: email });
  set({ account: email, phase: 'idle', error: null });
  const existing = await withToken(listBackups);
  if (isForeign(existing[0])) set({ phase: 'conflict', conflict: existing[0] });
  else void backupNow({ force: state.lastBackupAt === null });
  return existing;
}

export async function disableBackup(): Promise<void> {
  clearTimeout(timer);
  await account.signOut();
  await setMeta({ backup_enabled: '0', backup_account: null });
  set({ phase: 'off', account: null, error: null, conflict: null });
}

export function fetchBackups(): Promise<DriveBackup[]> {
  return withToken(listBackups);
}

/** Replaces this phone's data with a backup. This phone carries on backing up from there. */
export async function restoreBackup(backup: DriveBackup): Promise<void> {
  clearTimeout(timer);
  const data = await withToken((token) => downloadBackup(token, backup.id));
  await restoreSnapshot(db!, data);
  lastSeq = await currentSeq();
  ackFile = backup.id;
  await setMeta({ last_backup_seq: String(lastSeq), last_backup_at: backup.createdTime, backup_ack_file: ackFile });
  set({ phase: 'idle', lastBackupAt: backup.createdTime, conflict: null, error: null });
}

/** Keeps this phone's data despite another phone's newer backup, and backs it up. */
export async function keepThisPhone(): Promise<void> {
  if (!state.conflict) return;
  ackFile = state.conflict.id;
  await setMeta({ backup_ack_file: ackFile });
  set({ phase: 'idle', conflict: null });
  await backupNow({ force: true });
}

export const isThisDevice = (b: DriveBackup) => b.props.deviceId === deviceId;
