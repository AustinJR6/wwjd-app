// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const FIRESTORE_PARENT = `projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

import { useAuthStore } from '@/state/authStore';
import { getIdToken } from '@/services/authService';

export async function getAuthHeader() {
  const { authReady, uid } = useAuthStore.getState();

  if (!authReady) throw new Error('Auth not ready');

  const token = await getIdToken(true);
  console.warn('🪪 ID Token for Firestore access:', token?.slice(0, 20));
  console.warn('👤 Current auth UID:', uid);
  if (!token) throw new Error('Unable to refresh ID token');

  return { Authorization: `Bearer ${token}` };
}

export async function getAuthHeaders() {
  const { Authorization } = await getAuthHeader();
  return { Authorization, 'Content-Type': 'application/json' };
}
