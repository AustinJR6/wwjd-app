// 🚫 Do not use @react-native-firebase. This app uses Firebase Modular SDK architecture with centralized service abstraction.
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { sendSecureFirebaseRequest } from '@/utils/firebaseRequest';
import { API_URL } from '@/config/firebaseApp';
import { logTokenIssue, getIdToken } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';

export async function callFunction(name: string, data: any): Promise<any> {
  let headers;
  try {
    const token = await getIdToken(true);
    if (!token) throw new Error('Missing token');
    headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    console.log('Current user:', useAuthStore.getState().uid);
    console.log('ID Token:', token);
  } catch {
    logTokenIssue('function call');
    throw new Error('Missing auth token');
  }

  const url = `${API_URL}/${name}`;
  console.log('📡 Calling endpoint:', url);
  try {
    const res = await sendRequestWithGusBugLogging(() =>
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data ?? {}),
      })
    );

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
  const url = `${API_URL}/incrementReligionPoints`;
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

export async function createMultiDayChallenge(prompt: string, days: number) {
  return await callFunction('createMultiDayChallenge', { prompt, days });
}

export async function completeChallengeDay() {
  return await callFunction('completeChallengeDay', {});
}
