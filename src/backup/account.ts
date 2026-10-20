// Google sign-in for backup. The only API scope asked for is drive.appdata: a private app folder,
// with no access to the tutor's own Drive files.

import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ scopes: [DRIVE_APPDATA_SCOPE] });
  configured = true;
}

export class SignInCancelled extends Error {}

/** Asks the tutor to pick an account and allow the app folder. Returns the account's email. */
export async function signIn(): Promise<string> {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) throw new SignInCancelled();
    if (!res.data.scopes.includes(DRIVE_APPDATA_SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
      if (!added || !isSuccessResponse(added)) throw new SignInCancelled();
    }
    return res.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) throw new SignInCancelled();
    throw e;
  }
}

/** Restores the previous sign-in without UI. Null if the tutor has to sign in again. */
export async function restoreSignIn(): Promise<string | null> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  try {
    const res = await GoogleSignin.signInSilently();
    return res.type === 'success' ? res.data.user.email : null;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) return null;
    throw e;
  }
}

export async function signOut(): Promise<void> {
  configure();
  try {
    await GoogleSignin.signOut();
  } catch {}
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
