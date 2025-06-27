import { useAuthStore } from '@/state/authStore';

/**
 * Ensure the user is authenticated and the uid matches if provided.
 * Returns the stored uid when valid, otherwise null.
 */
export async function ensureAuth(expectedUid?: string): Promise<string | null> {
  const { uid, idToken } = useAuthStore.getState();

  if (!uid || !idToken) {
    console.warn('🚫 Firestore access blocked: missing auth');
    return null;
  }

  if (expectedUid && uid !== expectedUid) {
    console.warn('🚫 Firestore access blocked: uid mismatch');
    return null;
  }

  return uid;
}
