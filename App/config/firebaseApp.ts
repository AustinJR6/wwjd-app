export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const FIRESTORE_PARENT = `projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL || '';

import { checkAndRefreshIdToken } from '@/services/authService';

export async function getAuthHeader() {
  const token = await checkAndRefreshIdToken();
  if (!token) throw new Error('User not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export async function getAuthHeaders() {
  const { Authorization } = await getAuthHeader();
  return { Authorization, 'Content-Type': 'application/json' };
}
