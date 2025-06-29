// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const FIRESTORE_PARENT = `projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL || '';

import { useAuthStore } from '@/state/authStore';
import { getIdToken } from '@/services/authService';

export async function getAuthHeader() {
  const { authReady } = useAuthStore.getState();

  if (!authReady) throw new Error('Auth not ready');

  const token = await getIdToken(true);
  if (!token) throw new Error('Unable to refresh ID token');

  return { Authorization: `Bearer ${token}` };
}

export async function getAuthHeaders() {
  const { Authorization } = await getAuthHeader();
  return { Authorization, 'Content-Type': 'application/json' };
}
