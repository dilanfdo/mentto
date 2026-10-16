// Turns the live database into a compressed snapshot and back. Snapshots come from `VACUUM INTO`,
// which writes a consistent, compacted copy without blocking the app's own connection.

import { File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { gunzipSync, gzipSync } from 'fflate';

import { exclusive, type DB } from '@/db/core';
import { SCHEMA_VERSION, migrateDatabase } from '@/db/schema';
import { notifyDataChanged } from '@/lib/events';

/** Meta keys that describe this install rather than the tutor's data; a restore leaves them alone. */
export const LOCAL_META_KEYS = [
  'change_seq',
  'device_id',
  'backup_enabled',
  'backup_account',
  'last_backup_seq',
  'last_backup_at',
  'backup_ack_file',
];

const SNAPSHOT = 'backup-snapshot.db';
const RESTORE = 'backup-restore.db';

/** A filesystem path SQLite understands, from an expo-file-system `file://` URI. */
const toPath = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

function removeFile(name: string) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = new File(Paths.cache, name + suffix);
    if (f.exists) f.delete();
  }
}

export type Snapshot = { data: Uint8Array; changeSeq: number; students: number };

export function createSnapshot(db: DB): Promise<Snapshot> {
  return exclusive(() => snapshot(db));
}

async function snapshot(db: DB): Promise<Snapshot> {
  // Read the counter first: a write landing mid-snapshot leaves us dirty, which is the safe side.
  const seq = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'change_seq'");
  const students = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM students WHERE status = 'active'");
  removeFile(SNAPSHOT);
  const file = new File(Paths.cache, SNAPSHOT);
  try {
    await db.execAsync(`VACUUM INTO ${quote(toPath(file.uri))}`);
    const raw = await file.bytes();
    return { data: gzipSync(raw, { level: 6 }), changeSeq: Number(seq?.value ?? 0), students: students?.n ?? 0 };
  } finally {
    removeFile(SNAPSHOT);
  }
}

export class RestoreError extends Error {}

/**
 * Replaces every table's rows with the snapshot's, in one transaction, on the app's own connection
 * so open screens just re-read. Install-specific meta keys are kept.
 */
export async function restoreSnapshot(db: DB, gz: Uint8Array): Promise<void> {
  let raw: Uint8Array;
  try {
    raw = gunzipSync(gz);
  } catch {
    throw new RestoreError('This backup file is damaged.');
  }
  removeFile(RESTORE);
  const file = new File(Paths.cache, RESTORE);
  file.write(raw);

  try {
    // Check the copy on its own connection first, and bring an older backup up to today's schema.
    const copy = await openDatabaseAsync(RESTORE, undefined, toPath(Paths.cache.uri));
    try {
      const check = await copy.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (check?.integrity_check !== 'ok') throw new RestoreError('This backup file is damaged.');
      const v = await copy.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((v?.user_version ?? 0) > SCHEMA_VERSION) {
        throw new RestoreError('This backup was made by a newer version of Mentto. Update the app, then try again.');
      }
      await migrateDatabase(copy);
      await copy.execAsync('PRAGMA journal_mode = DELETE');
    } finally {
      await copy.closeAsync();
    }

    await exclusive(async () => {
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
      await db.execAsync(`ATTACH DATABASE ${quote(toPath(file.uri))} AS bk`);
      try {
        await db.withTransactionAsync(async () => {
          await db.execAsync('PRAGMA defer_foreign_keys = ON');
          const localKeys = LOCAL_META_KEYS.map(quote).join(', ');
          for (const { name } of tables) {
            const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA main.table_info(${ident(name)})`)).map((c) => c.name);
            const bkCols = new Set(
              (await db.getAllAsync<{ name: string }>(`PRAGMA bk.table_info(${ident(name)})`)).map((c) => c.name),
            );
            const shared = cols.filter((c) => bkCols.has(c)).map(ident).join(', ');
            const keep = name === 'meta' ? ` WHERE key NOT IN (${localKeys})` : '';
            await db.execAsync(`DELETE FROM main.${ident(name)}${keep}`);
            if (shared) {
              await db.execAsync(
                `INSERT INTO main.${ident(name)} (${shared}) SELECT ${shared} FROM bk.${ident(name)}${keep}`,
              );
            }
          }
        });
      } finally {
        await db.execAsync('DETACH DATABASE bk');
      }
    });
  } finally {
    removeFile(RESTORE);
  }
  notifyDataChanged();
}
