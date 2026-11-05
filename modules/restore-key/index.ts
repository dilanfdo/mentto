import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type RestoreKeyModule = {
  save(email: string): Promise<boolean>;
  takeRestored(): Promise<string | null>;
  clear(): Promise<void>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<RestoreKeyModule>('RestoreKey') : null;

/** Keeps a restore key for this account, which Android carries to the tutor's next phone. */
export async function saveRestoreKey(email: string): Promise<void> {
  await native?.save(email);
}

/** The account on the phone this install was moved from. Only looks on the install's first launch. */
export async function takeRestoredAccount(): Promise<string | null> {
  return (await native?.takeRestored()) ?? null;
}

/** Deletes the key after signing out, so the next phone doesn't sign in again. */
export async function clearRestoreKey(): Promise<void> {
  await native?.clear();
}
