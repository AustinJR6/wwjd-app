export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL || '';

import { getStoredToken } from '@/services/authService';

export async function getAuthHeader() {
  const idToken = await getStoredToken();
  if (!idToken) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${idToken}` };
}
