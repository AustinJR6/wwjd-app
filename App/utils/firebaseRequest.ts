import axios from 'axios';
import { getFreshIdToken } from '@/services/authService';

export async function sendSecureFirebaseRequest(url: string, data: any) {
  const idToken = await getFreshIdToken();
  if (!idToken) {
    console.warn('🚫 sendSecureFirebaseRequest without idToken');
    throw new Error('Missing auth token');
  }
  console.log('📤 Sending ID token in Authorization header');
  return axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  });
}
