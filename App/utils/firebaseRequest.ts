// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
import axios from 'axios';
import { getAuthHeader } from '@/config/firebaseApp';
import { logTokenIssue, getIdToken } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  const header = await getAuthHeader().catch(async () => {
    await logTokenIssue('sendSecureFirebaseRequest', false);
    throw new Error('Missing auth token');
  });
  const headers = { ...header, 'Content-Type': 'application/json' };
  console.log('Current user:', useAuthStore.getState().uid);
  const debugToken = await getIdToken();
  console.log('ID Token:', debugToken);
  console.log('📤 Sending ID token in Authorization header');
  return sendRequestWithGusBugLogging(() =>
    axios.post(url, data, { headers })
  );
}
