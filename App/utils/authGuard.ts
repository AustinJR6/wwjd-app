import * as SecureStore from 'expo-secure-store';
import { getStoredToken } from '@/services/authService';

/**
 * Ensure the user is authenticated and the uid matches if provided.
 * Returns the stored uid when valid, otherwise null.
 */
export async function ensureAuth(expectedUid?: string): Promise<string | null> {
  const [uid, token] = await Promise.all([
    SecureStore.getItemAsync('localId'),
    getStoredToken(),
  ]);

  if (!uid || !token) {
    console.warn('🚫 Firestore access blocked: missing auth');
    return null;
  }

  if (expectedUid && uid !== expectedUid) {
    console.warn('🚫 Firestore access blocked: uid mismatch');
    return null;
  }

  return uid;
}
