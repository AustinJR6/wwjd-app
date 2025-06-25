import axios from 'axios';
import { getIdToken, logTokenIssue } from '@/services/authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  const idToken = await getIdToken();
  if (!idToken) {
    await logTokenIssue('sendSecureFirebaseRequest', false);
    throw new Error('Missing auth token');
  }
  console.log('📤 Sending ID token in Authorization header');
  return sendRequestWithGusBugLogging(() =>
    axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    })
  );
}
