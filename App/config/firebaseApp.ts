export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const FIRESTORE_PARENT = `projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL || '';

import { useAuthStore } from '@/state/authStore';

export async function getAuthHeader() {
  const { idToken, authReady, refreshIdToken } = useAuthStore.getState();

  if (!authReady) throw new Error('Auth not ready');
  if (!idToken) {
    const refreshed = await refreshIdToken();
    if (!refreshed) throw new Error('Unable to refresh ID token');
  }

  const finalToken = useAuthStore.getState().idToken;
  if (!finalToken) throw new Error('Token still unavailable');

  return { Authorization: `Bearer ${finalToken}` };
}

export async function getAuthHeaders() {
  const { Authorization } = await getAuthHeader();
  return { Authorization, 'Content-Type': 'application/json' };
}
