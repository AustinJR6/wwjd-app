// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
import axios from 'axios';
import { logTokenIssue, getIdToken } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  let token: string | null = null;
  try {
    token = await getIdToken(true);
    if (!token) throw new Error('Missing token');
  } catch {
    await logTokenIssue('sendSecureFirebaseRequest', false);
    throw new Error('Missing auth token');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('Current user:', useAuthStore.getState().uid);
  console.log('ID Token:', token);
  console.log('📤 Sending ID token in Authorization header');
  return sendRequestWithGusBugLogging(() => axios.post(url, data, { headers }));
}
