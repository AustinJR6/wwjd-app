import { getIdToken as fbGetIdToken, getCurrentUserId as fbGetCurrentUserId } from '@/lib/auth';

export async function getIdToken(forceRefresh = false) {
  return fbGetIdToken(forceRefresh);
}

export async function getCurrentUserId(): Promise<string | null> {
  return fbGetCurrentUserId();
}

export async function getAuthHeader() {
  const token = await getIdToken(true);
  if (!token) throw new Error('Unable to refresh ID token');
  return { Authorization: `Bearer ${token}` };
}

export async function getAuthHeaders() {
  const { Authorization } = await getAuthHeader();
  return { Authorization, 'Content-Type': 'application/json' };
}

export async function getToken(forceRefresh = false) {
  return getIdToken(forceRefresh);
}
