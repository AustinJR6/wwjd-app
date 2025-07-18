import apiClient from '@/utils/apiClient';
import { logTokenIssue } from '@/shared/tokenLogger';
import { getIdToken } from '@/utils/authUtils';
import { useAuthStore } from '@/state/authStore';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  let token: string | null = null;
  try {
    token = await getIdToken(true);
    if (!token) throw new Error('Missing token');
  } catch {
    logTokenIssue('sendSecureFirebaseRequest');
    throw new Error('Missing auth token');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('Current user:', useAuthStore.getState().uid);
  console.log('ID Token:', token);
  console.log('📤 Sending ID token in Authorization header');
  return sendRequestWithGusBugLogging(
    () => apiClient.post(url, data, { headers }) as unknown as Promise<any>,
  );
}
