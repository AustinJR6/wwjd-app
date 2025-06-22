import { getStoredToken } from './authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { sendSecureFirebaseRequest } from '@/utils/firebaseRequest';

const BASE_URL = process.env.EXPO_PUBLIC_FUNCTION_BASE_URL;

export async function callFunction(name: string, data: any): Promise<any> {
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Function call without idToken');
    throw new Error('Missing auth token');
  }

  const url = `${BASE_URL}/${name}`;
  console.log('📡 Calling endpoint:', url);
  try {
    const res = await sendRequestWithGusBugLogging(() => fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(data ?? {}),
    }));

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Function call failed');
    }

    return res.json();
  } catch (err: any) {
    console.error('🔥 Backend error:', err?.response?.data || err.message);
    throw err;
  }
}

export async function incrementReligionPoints(
  religion: string,
  points: number,
): Promise<void> {
  const url = `${BASE_URL}/incrementReligionPoints`;
  console.log('📡 Calling endpoint:', url);
  try {
    await sendRequestWithGusBugLogging(() =>
      sendSecureFirebaseRequest(url, { religion, points })
    );
  } catch (err: any) {
    console.error('🔥 Backend error:', err?.response?.data || err.message);
    throw err;
  }
}
