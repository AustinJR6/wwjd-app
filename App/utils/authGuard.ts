/**
 * Ensure a UID value is present.
 * Returns the UID when valid, otherwise throws an error.
 */
export async function ensureAuth(uid?: string | null): Promise<string> {
  if (!uid) {
    throw new Error("Unauthorized – No user ID.");
  }

  return uid;
}
