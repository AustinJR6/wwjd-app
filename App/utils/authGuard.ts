/**
 * Ensure a UID value is present.
 * Returns the UID when valid, otherwise throws an error.
 */
import { getCurrentUserId } from './authUtils';

export async function ensureAuth(uid?: string | null): Promise<string> {
  const resolvedUid = uid ?? (await getCurrentUserId());
  if (!resolvedUid) {
    throw new Error('Unauthorized – No user ID.');
  }

  return resolvedUid;
}
