// Google sign-in for backup. The only API scope asked for is drive.appdata: a private app folder,
// with no access to the tutor's own Drive files.

import { Platform } from 'react-native';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { clearRestoreKey, saveRestoreKey, takeRestoredAccount } from '@modules/restore-key';

import { GOOGLE_IOS_CLIENT_ID } from '@/lib/config';

export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let configured = false;
function configure(accountName?: string) {
  if (configured && !accountName) return;
  GoogleSignin.configure({ scopes: [DRIVE_APPDATA_SCOPE], iosClientId: GOOGLE_IOS_CLIENT_ID || undefined, accountName });
  configured = true;
}

/** Never holds up sign-in: without a key the tutor just signs in by hand on the next phone. */
function keepRestoreKey(email: string) {
  saveRestoreKey(email).catch((e) => console.warn('Could not save the restore key', e));
}

export { takeRestoredAccount };

export class SignInCancelled extends Error {}

/** Asks the tutor to pick an account and allow the app folder. Returns the account's email. */
export async function signIn(): Promise<string> {
  // Without a client id the native sign-in would crash the app rather than fail.
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) throw new Error('Google sign-in isn’t available in this build.');
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) throw new SignInCancelled();
    if (!res.data.scopes.includes(DRIVE_APPDATA_SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
      if (!added || !isSuccessResponse(added)) throw new SignInCancelled();
    }
    keepRestoreKey(res.data.user.email);
    return res.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) throw new SignInCancelled();
    throw e;
  }
}

/**
 * Restores the previous sign-in without UI. Null if the tutor has to sign in again.
 * `moved` is the account from a restore key: it stands in when the sign-in itself didn't move here.
 */
export async function restoreSignIn(moved?: string | null): Promise<string | null> {
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) return null;
  configure();
  const previous = GoogleSignin.hasPreviousSignIn();
  if (!previous && !moved) return null;
  if (!previous && moved) configure(moved);
  // Google ended the session, so a new phone shouldn't try it. Not on a move: the account may simply
  // not be on this phone yet.
  const signedOut = async () => {
    if (!moved) await clearRestoreKey().catch(() => {});
    return null;
  };
  try {
    const res = await GoogleSignin.signInSilently();
    if (res.type !== 'success') return signedOut();
    keepRestoreKey(res.data.user.email);
    return res.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) return signedOut();
    throw e;
  }
}

export async function signOut(): Promise<void> {
  configure();
  try {
    await GoogleSignin.signOut();
  } catch {}
  await clearRestoreKey().catch(() => {});
}

// The native module allows one getTokens() at a time and rejects an overlapping call
// (ASYNC_OP_IN_PROGRESS), so callers that ask together (the backup list and the engine) share one.
let pending: Promise<string> | null = null;

/** A current access token. `stale` is one Drive rejected, dropped from the cache first. */
export function getAccessToken(stale?: string): Promise<string> {
  const run = async () => {
    if (pending) await pending.catch(() => {});
    configure();
    if (stale) await GoogleSignin.clearCachedAccessToken(stale);
    if (!GoogleSignin.getCurrentUser()) {
      const email = await restoreSignIn();
      if (!email) throw new NotSignedIn();
    }
    const { accessToken } = await GoogleSignin.getTokens();
    return accessToken;
  };
  if (pending && !stale) return pending;
  const p = run().finally(() => {
    if (pending === p) pending = null;
  });
  pending = p;
  return p;
}

export class NotSignedIn extends Error {
  constructor() {
    super('Sign in to Google again to keep backing up.');
  }
}
