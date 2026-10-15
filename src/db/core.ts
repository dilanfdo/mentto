import { randomUUID } from 'expo-crypto';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { notifyDataChanged, subscribeToDataChanges } from '@/lib/events';

export type DB = SQLiteDatabase;

export const newId = () => randomUUID();
export const timestamp = () => new Date().toISOString();

/**
 * Runs a set of writes in one transaction, bumps the change counter the backup watches, then tells
 * every open screen to re-read.
 */
export async function write(db: DB, fn: () => Promise<void>): Promise<void> {
  await db.withTransactionAsync(async () => {
    await fn();
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES ('change_seq', '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`,
    );
  });
  notifyDataChanged();
}

type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
};

/**
 * Loads data with `query` and re-runs it whenever `deps` change or anything in the database is
 * written. Previous data stays on screen during a refresh so lists don't flash.
 */
export function useQuery<T>(query: (db: DB) => Promise<T>, deps: readonly unknown[]) {
  const db = useSQLiteContext();
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: null, loading: true });
  const queryRef = useRef(query);
  queryRef.current = query;
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    try {
      const data = await queryRef.current(db);
      if (id === run.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (id === run.current) {
        setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  useEffect(() => {
    load();
    return subscribeToDataChanges(load);
  }, [load]);

  return { ...state, reload: load };
}
