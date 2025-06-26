import axios from 'axios';
import { getAuthHeader, logTokenIssue } from '@/services/authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  const header = await getAuthHeader().catch(async () => {
    await logTokenIssue('sendSecureFirebaseRequest', false);
    throw new Error('Missing auth token');
  });
  const headers = { ...header, 'Content-Type': 'application/json' };
  console.log('📤 Sending ID token in Authorization header');
  return sendRequestWithGusBugLogging(() =>
    axios.post(url, data, { headers })
  );
}
